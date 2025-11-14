"""Setup file for Babylon RL Training"""

from setuptools import setup, find_packages

setup(
    name="babylon-training",
    version="1.0.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    python_requires=">=3.10",
    install_requires=[
        "openpipe-art>=0.5.0",
        "asyncpg>=0.29.0",
        "python-dotenv>=1.0.0",
        "pydantic>=2.0.0",
        "openai>=1.0.0",
    ],
)

