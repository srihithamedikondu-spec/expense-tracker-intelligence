from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from datetime import datetime

from .database import engine, SessionLocal
from . import models, schemas
from .ml_service import predict_category
from .security import hash_password, verify_password

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=engine)



## Database Dependency

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


## Register

@app.post("/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):

    hashed = hash_password(user.password)

    new_user = models.User(
        username=user.username,
        password=hashed
    )

    db.add(new_user)
    db.commit()

    return {"message": "User created"}


## Login

@app.post("/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):

    db_user = db.query(models.User).filter(
        models.User.username == user.username
    ).first()

    if not db_user:
        return {"error": "User not found"}

    if not verify_password(user.password, db_user.password):
        return {"error": "Invalid password"}

    return {
        "message": "Login successful",
        "user_id": db_user.id
    }

## Create Expense

@app.post("/expense")
def create_expense(expense: schemas.ExpenseCreate, db: Session = Depends(get_db)):

    ## If category not provided, predict it
    category = expense.category if expense.category else predict_category(expense.title, db)

    new_expense = models.Expense(
        title=expense.title,
        amount=expense.amount,
        category=category,
        user_id=expense.user_id
    )

    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)

    return new_expense

## correcting category

@app.post("/correct-category/{expense_id}")
def correct_category(expense_id: int, new_category: str, db: Session = Depends(get_db)):

    expense = db.query(models.Expense).filter(
        models.Expense.id == expense_id
    ).first()

    if not expense:
        return {"message": "Expense not found"}

    expense.category = new_category

    new_correction = models.Correction(
        title=expense.title,
        category=new_category
    )

    db.add(new_correction)

    db.commit()
    db.refresh(expense)

    return {"message": "Category updated and learned"}


## Get User Expenses

@app.get("/expenses/{user_id}")
def get_expenses(user_id: int, db: Session = Depends(get_db)):

    expenses = db.query(models.Expense).filter(
        models.Expense.user_id == user_id
    ).all()

    return expenses


## Delete Expense

@app.delete("/expense/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):

    expense = db.query(models.Expense).filter(
        models.Expense.id == expense_id
    ).first()

    if not expense:
        return {"message": "Expense not found"}

    db.delete(expense)
    db.commit()

    return {"message": "Expense deleted successfully"}


## Set Budget

@app.post("/set-budget")
def set_budget(amount: float, user_id: int, db: Session = Depends(get_db)):

    now = datetime.now()

    existing_budget = db.query(models.Budget).filter(
        models.Budget.month == now.month,
        models.Budget.year == now.year,
        models.Budget.user_id == user_id
    ).first()

    if existing_budget:

        if existing_budget.change_count >= 3:
            return {"message": "Budget change limit reached"}

        existing_budget.amount = amount
        existing_budget.change_count += 1

    else:

        new_budget = models.Budget(
            month=now.month,
            year=now.year,
            amount=amount,
            user_id=user_id
        )

        db.add(new_budget)

    db.commit()

    return {"message": "Budget updated"}


## Monthly Report 

@app.get("/monthly-report/{user_id}")
def monthly_report(user_id: int, db: Session = Depends(get_db)):

    now = datetime.now()
    month = now.month
    year = now.year

    expenses = db.query(models.Expense).filter(
        models.Expense.user_id == user_id,
        extract('month', models.Expense.created_at) == month,
        extract('year', models.Expense.created_at) == year
    ).all()

    if not expenses:
        return {
            "total_spent": 0,
            "total_transactions": 0,
            "highest_spending_category": None,
            "budget": None,
            "budget_used_percentage": None,
            "remaining_budget": None,
            "charts": {"pie_chart": []}
        }

    ## Total spent
    total_spent = sum(e.amount for e in expenses)

    ## Category breakdown
    category_data = (
        db.query(models.Expense.category, func.sum(models.Expense.amount))
        .filter(
            models.Expense.user_id == user_id,
            extract('month', models.Expense.created_at) == month,
            extract('year', models.Expense.created_at) == year
        )
        .group_by(models.Expense.category)
        .all()
    )

    breakdown = {c: float(a) for c, a in category_data}

    highest_category = max(breakdown, key=breakdown.get)

    pie_chart = [
        {"category": c, "amount": a}
        for c, a in breakdown.items()
    ]

    ## Budget

    budget = db.query(models.Budget).filter(
        models.Budget.user_id == user_id,
        models.Budget.month == month,
        models.Budget.year == year
    ).first()

    budget_amount = None
    budget_used_percentage = None
    remaining_budget = None

    if budget:
        budget_amount = budget.amount
        budget_used_percentage = round((total_spent / budget.amount) * 100, 2)
        remaining_budget = round(budget.amount - total_spent, 2)

    return {
        "month": month,
        "year": year,
        "total_spent": total_spent,
        "total_transactions": len(expenses),
        "highest_spending_category": highest_category,
        "budget": budget_amount,
        "budget_used_percentage": budget_used_percentage,
        "remaining_budget": remaining_budget,
        "charts": {
            "pie_chart": pie_chart
        }
    }

from fastapi.responses import FileResponse
from reportlab.pdfgen import canvas
import matplotlib.pyplot as plt
from sqlalchemy import extract, func
from datetime import datetime

@app.get("/download-report/{user_id}")
def download_report(user_id: int, db: Session = Depends(get_db)):

    expenses = db.query(models.Expense).filter(
        models.Expense.user_id == user_id
    ).all()

    if not expenses:
        return {"message": "No expenses found"}

    ## SUMMARY
    total_spent = sum(e.amount for e in expenses)
    total_transactions = len(expenses)

    category_totals = {}

    for e in expenses:
        category_totals[e.category] = category_totals.get(e.category, 0) + e.amount

    highest_category = max(category_totals, key=category_totals.get)

    ## CREATE PIE CHART
    chart_path = f"category_chart_{user_id}.png"

    plt.figure(figsize=(4,4))
    plt.pie(
        category_totals.values(),
        labels=category_totals.keys(),
        autopct="%1.1f%%"
    )
    plt.title("Category Spending")
    plt.savefig(chart_path)
    plt.close()

    ## CREATE PDF
    file_path = f"expense_report_{user_id}.pdf"

    c = canvas.Canvas(file_path)

    y = 800

    c.setFont("Helvetica-Bold",16)
    c.drawString(180,y,"Expense Tracker Report")

    y -= 40

    c.setFont("Helvetica",12)
    c.drawString(50,y,f"Total Spent: ₹{total_spent}")

    y -= 20
    c.drawString(50,y,f"Transactions: {total_transactions}")

    y -= 20
    c.drawString(50,y,f"Highest Category: {highest_category}")

    y -= 50

    ## Insert Pie Chart
    c.drawImage(chart_path,150,y-200,width=300,height=200)

    y -= 240

    c.setFont("Helvetica-Bold",12)
    c.drawString(50,y,"Expense Details")

    y -= 20
    c.setFont("Helvetica",10)

    for e in expenses:

        line = f"{e.title} - ₹{e.amount} - {e.category} - {e.created_at.date()}"

        c.drawString(50,y,line)

        y -= 15

        if y < 50:
            c.showPage()
            y = 800

    c.save()

    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename="expense_report.pdf"
    )

## Forecast Spending prediction

from sklearn.linear_model import LinearRegression
import numpy as np

@app.get("/spending-forecast/{user_id}")
def forecast_spending(user_id: int, db: Session = Depends(get_db)):

    monthly_data = (
        db.query(
            extract('year', models.Expense.created_at).label('year'),
            extract('month', models.Expense.created_at).label('month'),
            func.sum(models.Expense.amount).label('total')
        )
        .filter(models.Expense.user_id == user_id)
        .group_by('year', 'month')
        .order_by('year', 'month')
        .all()
    )

    if len(monthly_data) < 2:
        return {"predicted_monthly_spending": 0}

    totals = [float(row.total) for row in monthly_data]

    X = np.array(range(len(totals))).reshape(-1, 1)
    y = np.array(totals)

    model = LinearRegression()
    model.fit(X, y)

    next_month_index = np.array([[len(totals)]])
    prediction = model.predict(next_month_index)[0]

    return {
        "predicted_monthly_spending": round(float(prediction), 2)
    }


## Savings Streak 

from datetime import datetime, timedelta

@app.get("/streak/{user_id}")
def check_streak(user_id: int, db: Session = Depends(get_db)):

    today = datetime.now().date()

    streak = db.query(models.Streak).filter(
        models.Streak.user_id == user_id
    ).first()

    ## Create streak if not exists
    if not streak:
        streak = models.Streak(
            user_id=user_id,
            current_streak=1,
            last_checkin=today
        )
        db.add(streak)
        db.commit()
        db.refresh(streak)

        return {
            "current_streak": streak.current_streak,
            "message": "First check-in 🔥"
        }

    ## If already checked today → do nothing
    if streak.last_checkin == today:
        return {
            "current_streak": streak.current_streak,
            "message": "Already checked in today ✅"
        }

    ## If yesterday → increase streak
    if streak.last_checkin == today - timedelta(days=1):
        streak.current_streak += 1

    ## If missed days → reset streak
    else:
        streak.current_streak = 1

    streak.last_checkin = today

    db.commit()

    return {
        "current_streak": streak.current_streak,
        "message": "Streak updated 🔥"
    }


@app.get("/expense-trend/{user_id}")
def expense_trend(user_id: int, db: Session = Depends(get_db)):

    monthly_data = (
        db.query(
            extract('year', models.Expense.created_at).label('year'),
            extract('month', models.Expense.created_at).label('month'),
            func.sum(models.Expense.amount).label('total')
        )
        .filter(models.Expense.user_id == user_id)
        .group_by('year', 'month')
        .order_by('year', 'month')
        .all()
    )

    trend = []

    for row in monthly_data:
        trend.append({
            "month": f"{int(row.month)}/{int(row.year)}",
            "total": float(row.total)
        })

    return {"trend": trend}


## Root

@app.get("/")
def root():
    return {"message": "Expense Tracker API running 🚀"}