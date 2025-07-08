import os
import subprocess
import time
from datetime import datetime

def run_tests():
    test_dir = 'tests'
    selected_tests = ['test-5.script.md', 'test-6.script.md', 'test-8.script.md', 'test-9.script.md', 'test-10.script.md']

    for i, script_file in enumerate(selected_tests):
        script_path = os.path.join(test_dir, script_file)
        print(f"[{datetime.now()}] Running test: {script_path}")
        subprocess.run(['python3.11', 'main.py', script_path])

        if i < len(selected_tests) - 1:
            print("Waiting 30 seconds before next test.\n")
            time.sleep(30)

def main():
    while True:
        print(f"[{datetime.now()}] Starting test run loop")
        run_tests()
        print(f"[{datetime.now()}] Test run complete. Waiting 10 minutes.\n")
        time.sleep(600)  # wait 10 minutes

if __name__ == '__main__':
    main()