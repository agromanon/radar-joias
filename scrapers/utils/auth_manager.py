"""
Authentication Manager for Kwara Scrapers
Handles multiple user accounts with rotation to avoid rate limits
"""

import requests
import json
import logging
import time
import os
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
import random
from dotenv import load_dotenv
from pathlib import Path

logger = logging.getLogger(__name__)

# Load environment variables from both possible locations
load_dotenv()  # scrapers/.env
try:
    # Also try to load from project root
    project_root = Path(__file__).parent.parent.parent
    env_file = project_root / '.env.local'
    if env_file.exists():
        load_dotenv(dotenv_path=env_file)
except:
    pass


@dataclass
class AuthAccount:
    """Represents an authenticated user account"""
    email: str
    password: str
    name: str = ""

    # Session state
    cookies: Dict = None
    last_used: datetime = None
    request_count: int = 0
    is_active: bool = True
    rate_limit_until: datetime = None

    def __post_init__(self):
        if self.cookies is None:
            self.cookies = {}
        if self.last_used is None:
            self.last_used = datetime.min


class AuthManager:
    """
    Manages authentication for Kwara.com.br scraping
    Handles multiple accounts with rotation to avoid rate limits
    """

    BASE_URL = "https://www.kwara.com.br"
    LOGIN_URL = f"{BASE_URL}/api/auth/signin"
    REFRESH_URL = f"{BASE_URL}/auth/refresh"

    def __init__(self):
        self.accounts: List[AuthAccount] = []
        self.current_account_index = 0
        self.session = requests.Session()

        # Load accounts from environment variables
        self._load_accounts()

        if not self.accounts:
            logger.warning("No authenticated accounts configured. Scraping will be limited to public API.")

    def _load_accounts(self):
        """Load accounts from environment variables

        Expected format:
        KWARA_ACCOUNT_1_EMAIL=user1@example.com
        KWARA_ACCOUNT_1_PASSWORD=password1
        KWARA_ACCOUNT_2_EMAIL=user2@example.com
        KWARA_ACCOUNT_2_PASSWORD=password2
        """
        account_index = 1
        while True:
            email = os.getenv(f'KWARA_ACCOUNT_{account_index}_EMAIL')
            password = os.getenv(f'KWARA_ACCOUNT_{account_index}_PASSWORD')

            if not email or not password:
                break

            account = AuthAccount(
                email=email,
                password=password,
                name=f"Account {account_index}"
            )
            self.accounts.append(account)
            logger.info(f"Loaded account: {email}")

            account_index += 1

    def login(self, account: AuthAccount) -> bool:
        """Perform login for a specific account"""
        try:
            # Clear existing session
            self.session.cookies.clear()

            # First, get the login page to obtain CSRF token if needed
            login_page_response = self.session.get(
                f"{self.BASE_URL}/login",
                timeout=30
            )

            # Attempt login with email/password
            login_data = {
                'email': account.email,
                'password': account.password,
                'remember': True
            }

            response = self.session.post(
                self.LOGIN_URL,
                json=login_data,
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                },
                timeout=30,
                allow_redirects=True
            )

            if response.status_code in [200, 201]:
                # Store cookies
                account.cookies = {cookie.name: cookie.value for cookie in self.session.cookies}
                account.is_active = True
                logger.info(f"Successfully logged in {account.email}")
                return True
            else:
                logger.error(f"Login failed for {account.email}: {response.status_code} - {response.text[:200]}")
                account.is_active = False
                return False

        except Exception as e:
            logger.error(f"Login error for {account.email}: {e}")
            account.is_active = False
            return False

    def get_next_account(self) -> Optional[AuthAccount]:
        """Get the next available account using round-robin rotation"""
        if not self.accounts:
            return None

        # Find next active account that's not rate limited
        attempts = 0
        max_attempts = len(self.accounts)

        while attempts < max_attempts:
            account = self.accounts[self.current_account_index]
            self.current_account_index = (self.current_account_index + 1) % len(self.accounts)

            # Check if account is active and not rate limited
            if account.is_active:
                # Check if rate limit has expired
                if account.rate_limit_until and datetime.now() < account.rate_limit_until:
                    attempts += 1
                    continue

                # Login if not already logged in
                if not account.cookies:
                    if self.login(account):
                        return account
                else:
                    return account

            attempts += 1

        logger.warning("All accounts are rate limited or inactive. Waiting...")
        return None

    def make_authenticated_request(self, url: str, method: str = 'GET', **kwargs) -> Optional[requests.Response]:
        """Make an authenticated request using account rotation"""
        max_retries = 3
        retry_delay = 5  # seconds

        for attempt in range(max_retries):
            account = self.get_next_account()

            if not account:
                logger.error("No available accounts for authenticated request")
                if attempt < max_retries - 1:
                    logger.info(f"Waiting {retry_delay}s before retry...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                    continue
                else:
                    return None

            # Apply cookies from account
            self.session.cookies.clear()
            for name, value in account.cookies.items():
                self.session.cookies.set(name, value)

            try:
                # Make request
                if method.upper() == 'GET':
                    response = self.session.get(url, timeout=30, **kwargs)
                elif method.upper() == 'POST':
                    response = self.session.post(url, timeout=30, **kwargs)
                else:
                    response = self.session.request(method, url, timeout=30, **kwargs)

                # Update account usage stats
                account.last_used = datetime.now()
                account.request_count += 1

                # Check for rate limiting
                if response.status_code == 429:
                    retry_after = int(response.headers.get('Retry-After', 300))  # Default 5 min
                    account.rate_limit_until = datetime.now() + timedelta(seconds=retry_after)
                    logger.warning(f"Rate limit hit for {account.email}. Waiting until {account.rate_limit_until}")
                    continue

                # Check for auth errors
                if response.status_code in [401, 403]:
                    logger.warning(f"Auth failed for {account.email}. Re-logging in...")
                    account.cookies = {}
                    if self.login(account):
                        # Retry with fresh session
                        continue
                    else:
                        account.is_active = False
                        continue

                # Success
                return response

            except requests.exceptions.RequestException as e:
                logger.error(f"Request error with {account.email}: {e}")
                continue

        logger.error("Failed to make authenticated request after all retries")
        return None

    def get_authenticated(self, url: str, **kwargs) -> Optional[requests.Response]:
        """Convenience method for GET requests"""
        return self.make_authenticated_request(url, 'GET', **kwargs)

    def refresh_all_sessions(self):
        """Refresh all account sessions"""
        for account in self.accounts:
            if account.is_active:
                logger.info(f"Refreshing session for {account.email}...")
                self.login(account)

    def get_stats(self) -> Dict:
        """Get statistics about account usage"""
        return {
            'total_accounts': len(self.accounts),
            'active_accounts': sum(1 for a in self.accounts if a.is_active),
            'rate_limited_accounts': sum(1 for a in self.accounts if a.rate_limit_until and datetime.now() < a.rate_limit_until),
            'total_requests': sum(a.request_count for a in self.accounts),
            'accounts': [
                {
                    'email': account.email,
                    'active': account.is_active,
                    'request_count': account.request_count,
                    'last_used': account.last_used.isoformat() if account.last_used != datetime.min else None,
                    'rate_limited_until': account.rate_limit_until.isoformat() if account.rate_limit_until else None
                }
                for account in self.accounts
            ]
        }


# Singleton instance for use across scrapers
_auth_manager_instance = None

def get_auth_manager() -> AuthManager:
    """Get or create the singleton AuthManager instance"""
    global _auth_manager_instance
    if _auth_manager_instance is None:
        _auth_manager_instance = AuthManager()
    return _auth_manager_instance
