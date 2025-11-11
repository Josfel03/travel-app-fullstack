Full-Stack E-Commerce Reservation System (Next.js, Flask, PostgreSQL, Stripe)

🚀 Live Demo

This application is fully deployed and operational.

Try the Live Frontend (Vercel): [https://travel-app-fullstack.vercel.app/]

See the Backend API (Railway): [https://travel-app-fullstack-production-23f9.up.railway.app]/api/test

📸 Project Showcase

This GIF demonstrates the complete user booking flow: selecting a date and time, choosing specific seats from the van map, filling passenger details, and being redirected to Stripe for payment.

![Project demo](./img/travelDemo.png)

📖 Project Overview

This is a production-ready, full-stack e-commerce application built to solve a real-world problem: managing reservations for a transportation route (Chilpancingo ↔ Mexico City). The system handles the entire customer journey, from browsing routes and visually selecting seats to secure payment via Stripe and instant PDF/QR code ticket generation.

It also includes a comprehensive, token-protected admin dashboard for complete operational control, including route management, schedule creation (CRUD), and live ticket validation via QR code scanning.

✨ Key Features

Admin Dashboard: Full CRUD functionality for routes, schedules (corridas), and drivers.

Interactive Seat Selection: Users can visually select available seats from a dynamic map of the van.

Secure Payment Gateway: Full integration with the Stripe API for processing payments, including webhook verification for robust order fulfillment.

QR Code Generation: Automatically generates a unique, verifiable PDF ticket and QR code upon successful payment.

User Authentication: Secure user login and profile management for the admin panel using JWT (JSON Web Tokens).

Responsive Frontend: Built with Next.js and Tailwind CSS for a fast, modern, and mobile-first UI.

🛠️ Tech Stack

Frontend

Framework: Next.js (App Router)

Language: TypeScript

Styling: Tailwind CSS

Deployment: Vercel

Backend

Framework: Flask

Language: Python

Server: Gunicorn

Deployment: Railway

Database

Database: PostgreSQL

Deployment: Railway

Core Services

Payments: Stripe API (Checkout & Webhooks)

Authentication: Flask-JWT-Extended

QR Generation: qrcode (Python)

PDF Generation: fpdf2 (Python)

⚙️ Local Installation & Setup

Follow these instructions to run the project on your local machine for development and testing.

Prerequisites

Git

Python 3.10+ and pip

Node.js (v18.0 or later) and npm

A running local instance of PostgreSQL

1. Clone the Repository

git clone [https://github.com/Josfel03/travel-app-fullstack](https://github.com/Josfel03/travel-app-fullstack)
cd [travel-app-fullstack]


2. Backend Setup (Flask)

Navigate to the backend directory:

cd backend


Create and activate a virtual environment:

python -m venv .venv
source .venv/bin/activate


Install the required Python packages:

pip install -r requirements.txt


Create your local environment file. Create a file named .env inside the backend/ folder and add your local secrets. (This project uses python-dotenv to load them automatically).

File: backend/.env

# Your local PostgreSQL connection string
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/your_db_name

# Your Stripe Test Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Your JWT secret key (generate a long random string)
JWT_SECRET_KEY=your_super_secret_jwt_key

# The URL of your local frontend (for CORS and Stripe redirects)
FRONTEND_URL=http://localhost:3000


3. Frontend Setup (Next.js)

Open a new terminal and navigate to the frontend directory:

cd frontend


Install the required Node.js packages:

npm install


Create your local environment file. Create a file named .env.local inside the frontend/ folder.

File: frontend/.env.local

# The URL of your local backend
NEXT_PUBLIC_API_URL=http://localhost:5000

# Your Stripe Test Public Key
NEXT_PUBLIC_STRIPE_KEY=pk_test_...


4. Database Initialization

Make sure your local PostgreSQL server is running.

Create a new database with the name you specified in DATABASE_URL (e.g., your_db_name).

Run the Flask backend (see Step 5).

Once the backend is running, open your browser and visit this URL one time to create all the database tables:
http://localhost:5000/api/create_tables

5. Running the Application

You must have two terminals running concurrently.

Terminal 1 (Backend):

cd backend
source .venv/bin/activate
flask --debug run --host 0.0.0.0 --port 5000


Terminal 2 (Frontend):

cd frontend
npm run dev


Your application is now running!

Frontend: http://localhost:3000

Backend: http://localhost:5000
