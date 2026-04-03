                # Check pagination metadata
                total_items = search_result.get('totalItems', 0)
                total_pages = search_result.get('totalPages', 0)

                # Log progress on first page
                if page == 1 and total_items > 0:
                    logger.info(f"  → Category contains {total_items} lots across {total_pages} pages")

                # FIXED: Continue pagination until last page
                if page >= total_pages:
                    logger.info(f"Reached last page ({page}/{total_pages})")
                    break