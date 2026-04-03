"""
Browser-based Authentication for Kwara.com.br
Uses Playwright headless browser to handle complex login flows
"""

import asyncio
import logging
from typing import Dict, Optional, List
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import json

try:
    from playwright.async_api import async_playwright, Browser, BrowserContext, Page
except ImportError:
    raise ImportError("Playwright is required. Install it with: pip install playwright")

logger = logging.getLogger(__name__)


@dataclass
class BrowserAuthAccount:
    """Represents an authenticated user account via browser"""
    email: str
    password: str
    name: str = ""

    # Browser context state
    context_state: Optional[str] = None  # Serialized browser context
    last_used: datetime = None
    request_count: int = 0
    is_active: bool = True

    def __post_init__(self):
        if self.last_used is None:
            self.last_used = datetime.min


class BrowserAuthManager:
    """
    Manages browser-based authentication for Kwara.com.br
    Uses Playwright to handle complex login flows (NextAuth.js, OAuth, etc.)
    """

    BASE_URL = "https://www.kwara.com.br"
    LOGIN_URL = f"{BASE_URL}/?isLoginDialogOpenOption=sign-in"  # Direct login dialog

    def __init__(self):
        self.accounts: List[BrowserAuthAccount] = []
        self.current_account_index = 0
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.contexts: Dict[str, BrowserContext] = {}

        # Load accounts from environment
        self._load_accounts()

        if not self.accounts:
            logger.warning("No authenticated accounts configured.")

    def _load_accounts(self):
        """Load accounts from environment variables"""
        import os
        from dotenv import load_dotenv
        from pathlib import Path

        # Load environment variables
        load_dotenv()
        try:
            project_root = Path(__file__).parent.parent.parent
            env_file = project_root / '.env.local'
            if env_file.exists():
                load_dotenv(dotenv_path=env_file)
        except:
            pass

        account_index = 1
        while True:
            email = os.getenv(f'KWARA_ACCOUNT_{account_index}_EMAIL')
            password = os.getenv(f'KWARA_ACCOUNT_{account_index}_PASSWORD')

            if not email or not password:
                break

            account = BrowserAuthAccount(
                email=email,
                password=password,
                name=f"Account {account_index}"
            )
            self.accounts.append(account)
            logger.info(f"Loaded account: {email}")

            account_index += 1

    async def start_browser(self):
        """Start the headless browser"""
        if self.browser is None:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox']
            )
            logger.info("Headless browser started")

    async def stop_browser(self):
        """Stop the headless browser"""
        if self.browser:
            await self.browser.close()
            self.browser = None
        if self.playwright:
            await self.playwright.stop()
            self.playwright = None
            logger.info("Headless browser stopped")

    async def login_account(self, account: BrowserAuthAccount) -> bool:
        """
        Perform login using headless browser
        Handles the full login flow including JavaScript, CSRF tokens, etc.
        """
        try:
            await self.start_browser()

            # Create new browser context
            context = await self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            )

            page = await context.new_page()

            # Navigate to login page
            logger.info(f"Navigating to login page for {account.email}")
            await page.goto(self.LOGIN_URL, wait_until='networkidle', timeout=30000)

            # Wait for login dialog to appear (it's a modal/overlay)
            logger.info(f"Waiting for login dialog...")
            await page.wait_for_timeout(3000)  # Wait 3s for dialog to load (increased from 2s)

            # Try multiple selectors for email field
            email_selectors = [
                'input[type="email"]',
                'input[name="email"]',
                'input[placeholder*="email" i]',
                'input[placeholder*="e-mail" i]',
            ]

            email_filled = False
            for selector in email_selectors:
                try:
                    await page.wait_for_selector(selector, timeout=5000)
                    logger.info(f"Entering email for {account.email} using selector: {selector}")

                    # Fill using element approach
                    element = await page.query_selector(selector)
                    if element:
                        await element.fill(account.email)
                        email_filled = True
                    break
                except:
                    continue

            if not email_filled:
                logger.error(f"Could not find email field for {account.email}")
                await context.close()
                return False

            # After entering email, we need to select "Acesso com senha" option
            logger.info(f"Selecting 'Acesso com senha' option...")

            # Wait for page to stabilize after entering email
            await page.wait_for_timeout(2000)

            # Look for the password option - use span selector (proven to work)
            password_option_selectors = [
                'span:has-text("Acesso com senha")',  # This works!
                'label:has-text("Acesso com senha")',
                'label:has-text("senha")',
                'input[type="radio"][value*="senha"]',
                'button:has-text("Acesso com senha")',
                'a:has-text("Acesso com senha")',
            ]

            option_clicked = False
            for selector in password_option_selectors:
                try:
                    # Query selector first (more reliable than page.click)
                    element = await page.query_selector(selector)
                    if element:
                        await element.click()
                        option_clicked = True
                        logger.info(f"Clicked password option using selector: {selector}")
                        break
                except:
                    # Try JavaScript click as fallback
                    try:
                        await page.evaluate(f'document.querySelector("{selector}").click()')
                        option_clicked = True
                        logger.info(f"Clicked password option using JavaScript: {selector}")
                        break
                    except:
                        continue

            if not option_clicked:
                logger.warning(f"Could not find 'Acesso com senha' option, trying to continue...")
                # Wait anyway to see if password field appears
                await page.wait_for_timeout(3000)
            else:
                # Successfully clicked the option, wait for password field to appear
                logger.info(f"Waiting for password field to appear after clicking option...")
                await page.wait_for_timeout(3000)  # Wait 3 seconds for field to appear

                # Try to click it again to ensure it's selected
                try:
                    for selector in password_option_selectors[:2]:  # Try first 2 selectors again
                        try:
                            element = await page.query_selector(selector)
                            if element:
                                await element.click()
                                logger.info(f"Clicked password option again to ensure it's selected")
                                await page.wait_for_timeout(1500)
                                break
                        except:
                            continue
                except:
                    pass

            # Try multiple selectors for password field
            password_selectors = [
                'input[type="password"]',
                'input[name="password"]',
                'input[placeholder*="senha" i]',
                'input[placeholder*="password" i]',
            ]

            password_filled = False
            for selector in password_selectors:
                try:
                    # Wait longer for password field (might need to appear dynamically)
                    await page.wait_for_selector(selector, timeout=5000)
                    logger.info(f"Entering password for {account.email} using selector: {selector}")
                    # Use element.fill() for more reliable filling
                    element = await page.query_selector(selector)
                    if element:
                        await element.fill(account.password)
                        password_filled = True
                        break
                except:
                    continue

            if not password_filled:
                logger.error(f"Could not find password field for {account.email}")

                # Try to take screenshot for debugging
                try:
                    screenshot_path = f"/tmp/login_debug_{account.email}.png"
                    await page.screenshot(path=screenshot_path)
                    logger.info(f"Screenshot saved to {screenshot_path}")
                except:
                    pass

                await context.close()
                return False

            # Click login button
            logger.info(f"Clicking login button for {account.email}")

            # Wait a bit for page to stabilize after filling password
            await page.wait_for_timeout(2000)

            # Try multiple possible selectors for login button
            login_selectors = [
                'button[type="submit"]',
                'button:has-text("Entrar")',
                'button:has-text("Entrar com Email")',
                'button:has-text("Login")',
                'button:has-text("Sign in")',
                'form button',
                'button:has([type="submit"])',
            ]

            login_clicked = False
            for selector in login_selectors:
                try:
                    element = await page.query_selector(selector)
                    if element:
                        # Use JavaScript click as fallback
                        try:
                            await element.click(timeout=5000)  # Shorter timeout
                        except:
                            # Try JavaScript click
                            await element.evaluate('el => el.click()')

                        login_clicked = True
                        logger.info(f"Clicked login button using selector: {selector}")
                        await page.wait_for_timeout(1000)
                        break
                except:
                    continue

            if not login_clicked:
                logger.error(f"Could not find login button for {account.email}")
                await context.close()
                return False

            # Wait for navigation after login
            logger.info(f"Waiting for redirect after login for {account.email}")

            # Wait for URL change or success indicator
            try:
                # Wait for either URL change or page load
                await page.wait_for_load_state('networkidle', timeout=15000)

                # Check if we're still on login page (failed)
                if 'login' in page.url.lower() or 'sign-in' in page.url.lower():
                    logger.error(f"Still on login page - authentication may have failed")

                    # Try to find error message
                    try:
                        error_selectors = [
                            'text=/erro|senha incorreta|email|senha inválida|invalid/i',
                            '[class*="error"]',
                            '[class*="alert"]',
                        ]
                        for selector in error_selectors:
                            element = await page.query_selector(selector)
                            if element:
                                error_text = await element.text_content()
                                logger.error(f"Error message found: {error_text}")
                                break
                    except:
                        pass

                    await context.close()
                    account.is_active = False
                    return False

                # Success! Save the browser context state
                account.context_state = await context.storage_state()
                account.is_active = True

                # Store context for later use
                self.contexts[account.email] = context

                logger.info(f"✓ Successfully logged in {account.email}")
                return True

            except Exception as e:
                logger.error(f"Login failed for {account.email}: {e}")
                await context.close()
                account.is_active = False
                return False

        except Exception as e:
            logger.error(f"Login error for {account.email}: {e}")
            account.is_active = False
            return False

    async def get_authenticated_page(self, account: BrowserAuthAccount) -> Optional[object]:
        """
        Get an authenticated page using saved browser context
        Returns a Playwright Page object ready for use
        """
        try:
            await self.start_browser()

            # Check if we have a saved context for this account
            if account.email in self.contexts:
                context = self.contexts[account.email]
            else:
                # Need to login first
                if not await self.login_account(account):
                    return None
                context = self.contexts[account.email]

            # Create new page from authenticated context
            page = await context.new_page()
            return page

        except Exception as e:
            logger.error(f"Error creating authenticated page: {e}")
            return None

    async def make_authenticated_request(
        self,
        url: str,
        account: Optional[BrowserAuthAccount] = None
    ) -> Optional[str]:
        """
        Make an authenticated request and return the page HTML
        """
        if not account:
            account = self.get_next_account()

        if not account:
            logger.error("No available accounts for authenticated request")
            return None

        try:
            page = await self.get_authenticated_page(account)
            if not page:
                return None

            # Navigate to the URL
            await page.goto(url, wait_until='networkidle', timeout=30000)

            # Get the page HTML
            html = await page.content()

            # Update account stats
            account.last_used = datetime.now()
            account.request_count += 1

            # Close the page (but keep the context)
            await page.close()

            return html

        except Exception as e:
            logger.error(f"Error making authenticated request: {e}")
            return None

    def get_next_account(self) -> Optional[BrowserAuthAccount]:
        """Get the next available account using round-robin rotation"""
        if not self.accounts:
            return None

        # Find next active account
        attempts = 0
        max_attempts = len(self.accounts)

        while attempts < max_attempts:
            account = self.accounts[self.current_account_index]
            self.current_account_index = (self.current_account_index + 1) % len(self.accounts)

            if account.is_active:
                return account

            attempts += 1

        logger.warning("No active accounts available")
        return None

    async def refresh_all_sessions(self):
        """Refresh all account sessions"""
        for account in self.accounts:
            if account.is_active:
                logger.info(f"Refreshing session for {account.email}...")
                await self.login_account(account)

    def get_stats(self) -> Dict:
        """Get statistics about account usage"""
        return {
            'total_accounts': len(self.accounts),
            'active_accounts': sum(1 for a in self.accounts if a.is_active),
            'total_requests': sum(a.request_count for a in self.accounts),
            'accounts': [
                {
                    'email': account.email,
                    'active': account.is_active,
                    'request_count': account.request_count,
                    'last_used': account.last_used.isoformat() if account.last_used != datetime.min else None,
                    'has_context': account.context_state is not None
                }
                for account in self.accounts
            ]
        }

    async def cleanup(self):
        """Cleanup resources"""
        await self.stop_browser()


# Singleton instance for use across scrapers
_auth_manager_instance = None


def get_browser_auth_manager() -> BrowserAuthManager:
    """Get or create the singleton BrowserAuthManager instance"""
    global _auth_manager_instance
    if _auth_manager_instance is None:
        _auth_manager_instance = BrowserAuthManager()
    return _auth_manager_instance
