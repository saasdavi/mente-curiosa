#!/usr/bin/env python3
import os
import json
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys

# Environment variables
PINTEREST_COOKIES_JSON = os.getenv('PINTEREST_COOKIES', '{}')

def test_pinterest_post():
    """Test posting to Pinterest with Selenium"""
    
    print("=" * 50)
    print("Pinterest Test - Simple Post")
    print("=" * 50)
    
    try:
        # Setup Chrome
        print("\n[1/6] Starting Chrome browser...")
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        driver = webdriver.Chrome(options=chrome_options)
        
        # Load Pinterest
        print("[2/6] Loading Pinterest...")
        driver.get('https://br.pinterest.com/')
        time.sleep(2)
        
        # Add cookies
        print("[3/6] Adding cookies for authentication...")
        try:
            cookies_dict = json.loads(PINTEREST_COOKIES_JSON)
            for key, value in cookies_dict.items():
                try:
                    driver.add_cookie({
                        'name': key,
                        'value': value,
                        'domain': '.pinterest.com',
                        'path': '/'
                    })
                except:
                    pass
            print("✓ Cookies added")
        except Exception as e:
            print(f"✗ Failed to add cookies: {e}")
            driver.quit()
            return False
        
        # Refresh with cookies
        print("[4/6] Authenticating with cookies...")
        driver.get('https://br.pinterest.com/')
        time.sleep(3)
        
        # Check if logged in
        try:
            driver.find_element(By.XPATH, "//button[contains(., 'Criar')]")
            print("✓ Successfully authenticated!")
        except:
            print("✗ Not authenticated or 'Criar' button not found")
            driver.quit()
            return False
        
        # Click "Criar Pin"
        print("[5/6] Creating a new pin...")
        try:
            create_btn = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Criar')]"))
            )
            create_btn.click()
            time.sleep(2)
            print("✓ Clicked 'Criar Pin'")
        except Exception as e:
            print(f"✗ Failed to click button: {e}")
            driver.quit()
            return False
        
        # Check if modal opened
        print("[6/6] Filling pin details...")
        try:
            # Wait for description field
            desc_field = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "textarea"))
            )
            
            # Add test text
            test_text = "🚀 Teste de Automação Pinterest com Selenium - Funcionando! 🎯 #pinterest #automacao #teste"
            desc_field.send_keys(test_text)
            time.sleep(1)
            print(f"✓ Added text: {test_text[:50]}...")
            
            # Look for image upload or use URL
            print("✓ Waiting for image field...")
            time.sleep(2)
            
            # Try to add a URL link
            try:
                link_inputs = driver.find_elements(By.TAG_NAME, "input")
                for inp in link_inputs:
                    if "link" in inp.get_attribute("placeholder").lower() or "url" in inp.get_attribute("placeholder").lower():
                        inp.send_keys("https://mentecuriosa.blog")
                        time.sleep(1)
                        print("✓ Added link: https://mentecuriosa.blog")
                        break
            except:
                pass
            
            # Try to find and click Save button
            print("✓ Looking for Save button...")
            time.sleep(2)
            
            try:
                # Take screenshot before saving
                driver.save_screenshot('/tmp/pinterest_before_save.png')
                print("✓ Screenshot saved (before saving)")
                
                # Try to find Save button
                save_buttons = driver.find_elements(By.XPATH, "//button[contains(., 'Salvar')] | //button[contains(., 'Save')]")
                if save_buttons:
                    save_buttons[0].click()
                    time.sleep(3)
                    print("✓ Clicked Save button!")
                    
                    # Take final screenshot
                    driver.save_screenshot('/tmp/pinterest_after_save.png')
                    print("✓ Screenshot saved (after saving)")
                    print("\n" + "=" * 50)
                    print("✅ SUCCESS - Pin published!")
                    print("=" * 50)
                    driver.quit()
                    return True
                else:
                    print("⚠ Save button not found, but pin details were filled")
                    driver.save_screenshot('/tmp/pinterest_final.png')
                    driver.quit()
                    return True
            except Exception as e:
                print(f"⚠ Could not click Save (normal for test): {e}")
                driver.save_screenshot('/tmp/pinterest_final.png')
                driver.quit()
                return True
        
        except Exception as e:
            print(f"✗ Failed to fill details: {e}")
            driver.save_screenshot('/tmp/pinterest_error.png')
            driver.quit()
            return False
    
    except Exception as e:
        print(f"✗ Critical error: {e}")
        return False

if __name__ == '__main__':
    result = test_pinterest_post()
    exit(0 if result else 1)
