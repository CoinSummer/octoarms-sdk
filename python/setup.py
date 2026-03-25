from setuptools import find_packages, setup


setup(
    name="chainbase-collector-sdk",
    version="0.1.0",
    description="Python collector SDK for Chainbase task runtime",
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    author="CoinSummer",
    python_requires=">=3.10",
    packages=find_packages(include=["collector_sdk", "collector_sdk.*"]),
    include_package_data=False,
)
