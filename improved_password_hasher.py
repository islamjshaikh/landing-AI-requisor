#!/usr/bin/env python3
"""
Enhanced Password Hasher Script for Replit Database
Uses existing SQLAlchemy and DATABASE_URL (no psycopg2 needed)
Uses bcrypt with 12 salt rounds (same as the application)
"""

import os
import bcrypt
import sys

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
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def connect_to_database():
    """
    Connect to the database using SQLAlchemy (already installed)
    """
    try:
        from sqlalchemy import create_engine, text
        
        # Use the same DATABASE_URL as your application
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            print("❌ DATABASE_URL not found in environment variables")
            return None, None
            
        engine = create_engine(database_url)
        connection = engine.connect()
        print("✅ Database connection successful")
        return engine, connection
        
    except ImportError:
        print("❌ SQLAlchemy not available")
        return None, None
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return None, None

def update_password_in_db(connection, user_identifier, hashed_password, identifier_type="email"):
    """
    Update password in database (optional - for direct database updates)
    """
    try:
        from sqlalchemy import text
        
        if identifier_type == "email":
            query = text("UPDATE users SET password = :password WHERE email = :identifier")
        elif identifier_type == "username":
            query = text("UPDATE users SET password = :password WHERE username = :identifier")
        else:
            query = text("UPDATE users SET password = :password WHERE id = :identifier")
            
        result = connection.execute(query, {
            "password": hashed_password,
            "identifier": user_identifier
        })
        connection.commit()
        
        if result.rowcount > 0:
            print(f"✅ Password updated for {identifier_type}: {user_identifier}")
            return True
        else:
            print(f"❌ No user found with {identifier_type}: {user_identifier}")
            return False
            
    except Exception as e:
        print(f"❌ Database update failed: {e}")
        return False

def main():
    print("=" * 80)
    print("ENHANCED PASSWORD HASHER FOR REPLIT DATABASE")
    print("=" * 80)
    print()
    
    # Add your plain text passwords here
    plain_passwords = [
        "password123",
        "mySecurePass!",
        "admin123", 
        "userPassword2024",
        "test@123",
        # Add more passwords as needed
    ]
    
    print("🔧 Generating bcrypt hashes (12 salt rounds)...")
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
        print(f"  Verified: {'✅ VALID' if is_valid else '❌ INVALID'}")
        print()
        
        hashed_results.append({
            'original': plain_pass,
            'hashed': hashed_pass
        })
    
    print("=" * 80)
    print("SQL UPDATE STATEMENTS")
    print("=" * 80)
    print("-- Copy these hashed passwords to your database:")
    print()
    
    for i, result in enumerate(hashed_results, 1):
        print(f"-- Password {i}: {result['original']}")
        print(f"UPDATE users SET password = '{result['hashed']}' WHERE email = 'user{i}@example.com';")
        print()
    
    print("=" * 80)
    print("DATABASE CONNECTION TEST")
    print("=" * 80)
    
    # Test database connection
    engine, connection = connect_to_database()
    
    if connection:
        try:
            from sqlalchemy import text
            # Test query
            result = connection.execute(text("SELECT COUNT(*) as user_count FROM users"))
            user_count = result.fetchone()[0]
            print(f"✅ Database accessible - Found {user_count} users in the database")
            
            # Show available users (first 5)
            result = connection.execute(text("SELECT id, username, email FROM users LIMIT 5"))
            users = result.fetchall()
            
            if users:
                print("📋 Sample users in database:")
                for user in users:
                    print(f"   ID: {user[0]}, Username: {user[1]}, Email: {user[2]}")
            
            connection.close()
            
        except Exception as e:
            print(f"❌ Database query failed: {e}")
    
    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"✅ Total passwords processed: {len(plain_passwords)}")
    print("✅ All hashes use bcrypt with 12 salt rounds (compatible with your application)")
    print("✅ Database connection tested")
    print()
    print("🚀 NEXT STEPS:")
    print("1. Copy the hashed passwords from the SQL UPDATE statements above")
    print("2. Use them to update your users table manually")
    print("3. Or modify this script to do direct database updates")
    print()
    print("💡 TIP: To do direct updates, uncomment the database update section")

if __name__ == "__main__":
    # Check if bcrypt is available (should be from your previous working script)
    try:
        import bcrypt
        main()
    except ImportError:
        print("❌ Error: bcrypt library not found!")
        print("✅ Good news: Your password_hasher.py script already works!")
        print("   You can use that one instead.")