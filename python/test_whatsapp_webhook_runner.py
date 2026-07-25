import subprocess
import sys

def main():
    print("Running WhatsApp Webhook verification script...")
    res = subprocess.run(["npx.cmd", "tsx", "test_whatsapp_webhook.ts"], capture_output=True, text=True, cwd=".")
    print("STDOUT:")
    print(res.stdout)
    print("STDERR:")
    print(res.stderr)
    print(f"Return code: {res.returncode}")
    sys.exit(res.returncode)

if __name__ == "__main__":
    main()
