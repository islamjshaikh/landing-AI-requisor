import random
from tabulate import tabulate

# --- Example input: replace this with your actual data source ---
users = [{
    "email": "john.smith@example.com",
    "first_name": "John",
    "last_name": "Smith"
}, {
    "email": "eric.bergthold@gmail.com",
    "first_name": None,
    "last_name": None
}, {
    "email": "anonymous@example.com",
    "first_name": "Anonymous",
    "last_name": "User"
}, {
    "email": "masha.terre@gmail.com",
    "first_name": "Maria",
    "last_name": "Terre"
}, {
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User"
}, {
    "email": "naveen@staythanks.com",
    "first_name": None,
    "last_name": None
}, {
    "email": "roxx2403@gmail.com",
    "first_name": "roxx",
    "last_name": "roxx"
}, {
    "email": "islamjshaikh@gmail.com",
    "first_name": "Islam ",
    "last_name": "Shaikh"
}, {
    "email": "optsoundz@gmail.com",
    "first_name": "Mwanje",
    "last_name": "Thompson"
}, {
    "email": "nelso972@uwm.edu",
    "first_name": None,
    "last_name": None
}, {
    "email": "demo@requisor.ai",
    "first_name": None,
    "last_name": None
}, {
    "email": "angkan.mukherjee@gmail.com",
    "first_name": None,
    "last_name": None
}, {
    "email": "audiomogulsmedia@gmail.com",
    "first_name": "Audio ",
    "last_name": "Moguls "
}, {
    "email": "naveenlalitk@gmail.com",
    "first_name": None,
    "last_name": None
}, {
    "email": "finucane@yahoo.com",
    "first_name": None,
    "last_name": None
}, {
    "email": "zodeyash98@gmail.com",
    "first_name": "Yash",
    "last_name": "Zode"
}, {
    "email": "techprogram98@gmail.com",
    "first_name": "Yash",
    "last_name": "Z"
}, {
    "email": "chad.mason@advanced-ionics.com",
    "first_name": None,
    "last_name": None
}, {
    "email": "prateemakarande@gmail.com",
    "first_name": "Prateema",
    "last_name": "Karande"
}, {
    "email": "support@requisor.io",
    "first_name": "Requisor",
    "last_name": "Team"
}, {
    "email": "jeremiahwalker19@gmail.com",
    "first_name": None,
    "last_name": None
}, {
    "email": "yash@requisor.io",
    "first_name": "Yash",
    "last_name": "Zode"
}, {
    "email": "naveen@thecitruslife.com",
    "first_name": "Naveen",
    "last_name": "Kankate"
}, {
    "email": "john@staythanks.com",
    "first_name": "john",
    "last_name": "Warren"
}, {
    "email": "karen.a.hine@gmail.com",
    "first_name": None,
    "last_name": None
}, {
    "email": "johnmccannwarren@gmail.com",
    "first_name": None,
    "last_name": None
}, {
    "email": "ekapsy@gmail.com",
    "first_name": None,
    "last_name": None
}, {
    "email": "adi007thebest@gmail.com",
    "first_name": None,
    "last_name": None
}]


NUM_DIGITS = 8

def _name_part(first_name, last_name, email):
    fn = (first_name or email.split("@")[0]).strip().replace(" ", "")
    ln = (last_name or "User").strip().replace(" ", "")
    return fn.capitalize() + ln.capitalize()

def _unique_numbers(count, digits=8):
    start = 10**(digits-1)
    end = 10**digits - 1
    return random.sample(range(start, end+1), count)

def generate_plain_passwords(users_list, digits=NUM_DIGITS):
    to_update = [u for u in users_list if u.get("password") is None]
    unique_nums = _unique_numbers(len(to_update), digits)
    results = []
    for i, u in enumerate(to_update):
        email = u["email"]
        fn, ln = u.get("first_name"), u.get("last_name")
        name = _name_part(fn, ln, email)
        plain_pwd = f"{name}@{unique_nums[i]}"
        results.append(plain_pwd)
    return results

if __name__ == "__main__":
    passwords = generate_plain_passwords(users)
    print(passwords)