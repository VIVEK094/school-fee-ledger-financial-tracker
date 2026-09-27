# School Fee Ledger & Financial Tracker

A single-page school fee management application developed using Django, SQLite, HTML, CSS and JavaScript.

## Technology Stack

- Python
- Django
- SQLite
- HTML5
- CSS3
- JavaScript

## Features

- Student fee collection
- SQLite database persistence
- Financial dashboard
- Transaction history
- Latest 10 transactions
- Payment mode tracking
- Academic term tracking
- REST-style API endpoints
- Responsive user interface

## API Endpoints

GET /api/finance/history

POST /api/finance/collect

GET /api/logs

## How to Run

### 1. Create virtual environment

python -m venv venv

### 2. Activate virtual environment

Windows:

venv\Scripts\activate

### 3. Install dependencies

pip install -r requirements.txt

### 4. Run migrations

python manage.py migrate

### 5. Start the server

python manage.py runserver

### 6. Open in browser

http://127.0.0.1:8000/

## Database

The project uses Django's SQLite backend. Django creates and updates the local database schema from the finance app migrations.

Database file: `db.sqlite3`

Fee records are stored in the `fee_collections` table with these required columns:

| Column | Database type | Purpose |
| --- | --- | --- |
| `id` | Integer primary key | Unique payment record identifier |
| `student_reg_number` | Text (up to 50 characters) | Student registration number |
| `amount_paid` | Positive integer | Amount received |
| `payment_mode` | Text (up to 30 characters) | Cash, UPI, Card, or Bank Transfer |
| `academic_term` | Text (up to 50 characters) | Academic year/term |
| `created_at` | Timestamp | Automatically set when the record is created |

The ledger also stores optional `expected_fee` and `is_verified` audit fields. They support arrears and verification reporting; existing payment submissions can omit them.

To create or update the database tables after cloning the project, run:

```bash
python manage.py migrate
```
++


