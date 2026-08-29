#!/usr/bin/env python3
"""
SSL Certificate Expiration Checker Helper
Executes asynchronous parallel TLS handshakes to verify expiration dates.
"""
import sys
import json
import subprocess
import datetime
import concurrent.futures
import re

def check_single_site(site_str, warning_days=7):
    site_str = site_str.strip()
    if not site_str:
        return None
        
    # Strip URL scheme and trailing path/slashes
    clean_host = re.sub(r'^https?://', '', site_str)
    clean_host = clean_host.split('/')[0].strip()
    
    parts = clean_host.split(':')
    host = parts[0]
    port = parts[1] if len(parts) > 1 else '443'
    
    if not host:
        return None

    # Use OpenSSL s_client with SNI
    cmd = [
        "openssl", "s_client",
        "-servername", host,
        "-connect", f"{host}:{port}"
    ]
    
    try:
        proc1 = subprocess.Popen(
            cmd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL
        )
        proc2 = subprocess.Popen(
            ["openssl", "x509", "-noout", "-enddate", "-subject", "-issuer"],
            stdin=proc1.stdout,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True
        )
        if proc1.stdout:
            proc1.stdout.close()
            
        output, _ = proc2.communicate(timeout=10)
        proc1.wait(timeout=2)
        
        not_after_match = re.search(r'notAfter=(.+)', output)
        if not not_after_match:
            return {
                "site": site_str,
                "host": host,
                "port": port,
                "status": "error",
                "days_left": None,
                "expiry_str": None,
                "error": "Could not retrieve certificate"
            }
            
        date_str = not_after_match.group(1).strip()
        date_str_clean = re.sub(r'\s+', ' ', date_str)
        
        expiry = None
        for fmt in ("%b %d %H:%M:%S %Y %Z", "%b %d %H:%M:%S %Y"):
            try:
                expiry = datetime.datetime.strptime(date_str_clean, fmt)
                expiry = expiry.replace(tzinfo=datetime.timezone.utc)
                break
            except Exception:
                pass
                
        if not expiry:
            return {
                "site": site_str,
                "host": host,
                "port": port,
                "status": "error",
                "days_left": None,
                "expiry_str": date_str,
                "error": f"Failed to parse date: {date_str}"
            }
            
        now = datetime.datetime.now(datetime.timezone.utc)
        diff = expiry - now
        days_left = diff.total_seconds() / 86400.0
        days_rounded = round(days_left, 1)
        
        if days_left < 0:
            status = "expired"
        elif days_left <= warning_days:
            status = "warning"
        else:
            status = "ok"
            
        return {
            "site": site_str,
            "host": host,
            "port": port,
            "status": status,
            "days_left": days_rounded,
            "expiry_iso": expiry.isoformat(),
            "expiry_str": expiry.strftime("%Y-%m-%d %H:%M UTC"),
            "error": None
        }
    except subprocess.TimeoutExpired:
        return {
            "site": site_str,
            "host": host,
            "port": port,
            "status": "error",
            "days_left": None,
            "expiry_str": None,
            "error": "Connection timed out"
        }
    except Exception as e:
        return {
            "site": site_str,
            "host": host,
            "port": port,
            "status": "error",
            "days_left": None,
            "expiry_str": None,
            "error": str(e)
        }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"overall_status": "ok", "results": [], "checked_at": None}))
        return
        
    try:
        sites_input = json.loads(sys.argv[1])
    except Exception:
        sites_input = [s.strip() for s in sys.argv[1].split(',') if s.strip()]
        
    warning_days = 7
    if len(sys.argv) > 2:
        try:
            warning_days = float(sys.argv[2])
        except ValueError:
            pass
            
    if not sites_input:
        print(json.dumps({
            "overall_status": "ok",
            "checked_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "results": []
        }))
        return
        
    results = []
    max_workers = min(12, max(1, len(sites_input)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_site = {executor.submit(check_single_site, site, warning_days): site for site in sites_input}
        for future in concurrent.futures.as_completed(future_to_site):
            res = future.result()
            if res:
                results.append(res)
                
    # Sort order: expired first, error second, warning third, ok last
    status_order = {"expired": 0, "error": 1, "warning": 2, "ok": 3}
    results.sort(key=lambda x: (status_order.get(x["status"], 4), x["days_left"] if x["days_left"] is not None else -9999))
    
    overall_status = "ok"
    if any(r["status"] in ("expired", "error") for r in results):
        overall_status = "expired"
    elif any(r["status"] == "warning" for r in results):
        overall_status = "warning"
        
    output = {
        "overall_status": overall_status,
        "checked_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "results": results
    }
    print(json.dumps(output))

if __name__ == "__main__":
    main()
