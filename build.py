import subprocess


def build_project():
    try:
        subprocess.run(
            "rm -rf dist/ node_modules/.vite/ .vite/ && npm run build",
            shell=True,
            check=True)
        print("Build completed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Build failed: {e}")


if __name__ == "__main__":
    build_project()
