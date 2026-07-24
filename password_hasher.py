#!/usr/bin/env python3
"""
Password Hasher Script for Database
Uses bcrypt with 12 salt rounds (same as the application)
"""

import bcrypt


def hash_password(plain_password):
    """
    Hash a password using bcrypt with 12 salt rounds
    Same method as used in the application (bcrypt.hash(password, 12))
    """
    # Convert string to bytes (required by bcrypt)
    password_bytes = plain_password.encode('utf-8')

    # Generate salt with 12 rounds (same as application)
    salt = bcrypt.gensalt(rounds=12)

    # Hash the password
    hashed = bcrypt.hashpw(password_bytes, salt)

    # Return as string (for database storage)
    return hashed.decode('utf-8')


def verify_password(plain_password, hashed_password):
    """
    Verify a password against its hash (for testing)
    """
    return bcrypt.checkpw(plain_password.encode('utf-8'),
                          hashed_password.encode('utf-8'))


def main():
    # Add your plain text passwords here
    plain_passwords = [
        'passwords shuld be here',
    ]

    print("=" * 80)
    print("PASSWORD HASHING RESULTS")
    print("=" * 80)
    print()

    hashed_results = []

    for i, plain_pass in enumerate(plain_passwords, 1):
        print(f"Password {i}:")
        print(f"  Original: {plain_pass}")

        # Hash the password
        hashed_pass = hash_password(plain_pass)
        print(f"  Hashed:   {hashed_pass}")

        # Verify the hash works correctly
        is_valid = verify_password(plain_pass, hashed_pass)
        print(f"  Verified: {'✓ VALID' if is_valid else '✗ INVALID'}")
        print()

        hashed_results.append({'original': plain_pass, 'hashed': hashed_pass})

    print("=" * 80)
    print("SQL INSERT STATEMENTS")
    print("=" * 80)
    print("-- Copy these hashed passwords to your database:")
    print()

    for result in hashed_results:
        print(f"-- Original: {result['original']}")
        print(f"-- Hashed:   '{result['hashed']}'")
        print()

    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total passwords processed: {len(plain_passwords)}")
    print(
        "All hashes use bcrypt with 12 salt rounds (compatible with your application)"
    )
    print()
    print("To use these hashes:")
    print(
        "1. Copy the hashed password (the long string starting with $2b$12$)")
    print("2. Insert it into the password column in your users table")
    print(
        "3. The application will be able to verify login with the original password"
    )


if __name__ == "__main__":
    # Check if bcrypt is installed
    try:
        import bcrypt
        main()
    except ImportError:
        print("Error: bcrypt library not found!")
        print("Install it with: pip install bcrypt")
        print("Or: pip3 install bcrypt")
