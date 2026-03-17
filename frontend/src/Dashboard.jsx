import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

function Dashboard() {

  const [expenses, setExpenses] = useState([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [budget, setBudget] = useState("");
  const [report, setReport] = useState(null);
  const [streak, setStreak] = useState(0);
  const [forecast, setForecast] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [trend, setTrend] = useState([]);

  const userId = localStorage.getItem("user_id");

  const COLORS = ["#f97316", "#16a34a", "#ef4444", "#3b82f6"];

  const logout = () => {
    localStorage.removeItem("user_id");
    window.location.reload();
  };


  // API CALLS

  const fetchExpenses = async () => {
    const res = await fetch(`https://expense-tracker-intelligence.onrender.com/expenses/${userId}`);
    const data = await res.json();
    setExpenses(data);
  };

  const fetchReport = async () => {
    const res = await fetch(`https://expense-tracker-intelligence.onrender.com/monthly-report/${userId}`);
    const data = await res.json();
    setReport(data);
  };

  const fetchStreak = async () => {
    const res = await fetch(`https://expense-tracker-intelligence.onrender.com/streak/${userId}`);
    const data = await res.json();
    setStreak(data.current_streak);
  };

  const fetchForecast = async () => {
    const res = await fetch(`https://expense-tracker-intelligence.onrender.com/spending-forecast/${userId}`);
    const data = await res.json();
    setForecast(data.predicted_monthly_spending);
  };

  const fetchTrend = async () => {
    const res = await fetch(`https://expense-tracker-intelligence.onrender.com/expense-trend/${userId}`);
    const data = await res.json();
    setTrend(data.trend);
  };

  const downloadReport = () => {
    window.open(`https://expense-tracker-intelligence.onrender.com/download-report/${userId}`);
  };

  useEffect(() => {
    fetchExpenses();
    fetchReport();
    fetchStreak();
    fetchForecast();
    fetchTrend();
  }, []);

  // EXPENSE ACTIONS
  
  const addExpense = async (e) => {
    e.preventDefault();

    if (!title || !amount || amount <= 0) {
      alert("Please enter valid expense");
      return;
    }

    try {

      const res = await fetch("https://expense-tracker-intelligence.onrender.com/expense", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: title,
          amount: parseFloat(amount),
          user_id: parseInt(userId)
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert("Failed to add expense");
        return;
      }

      setTitle("");
      setAmount("");

      fetchExpenses();
      fetchReport();

    } catch (error) {
      console.error("Error adding expense:", error);
    }
  };

  const deleteExpense = async (id) => {
    await fetch(`https://expense-tracker-intelligence.onrender.com/expense/${id}`, {
      method: "DELETE"
    });

    fetchExpenses();
    fetchReport();
  };

  const updateCategory = async (expenseId, newCategory) => {

    await fetch(
      `https://expense-tracker-intelligence.onrender.com/correct-category/${expenseId}?new_category=${newCategory}`,
      {
        method: "POST"
      }
    );

    fetchExpenses();
    fetchReport();
  };

  const setMonthlyBudget = async (e) => {
    e.preventDefault();

    if (!budget) return;

    await fetch(`https://expense-tracker-intelligence.onrender.com/set-budget?amount=${budget}&user_id=${userId}`, {
      method: "POST"
    });

    setBudget("");
    fetchReport();
  };

  return (
    <div>

      <div className="navbar">
        <h2 className="logo">ExpenseTracker</h2>

        <div className="nav-actions">

          <button className="download-btn" onClick={downloadReport}>
            Download Report
          </button>

          <button className="logout-btn" onClick={logout}>
            Logout
          </button>

        </div>
      </div>

      <div className="container">

        {report && (
          <div className="stats-grid">

            <div className="stat-card">
              <div className="stat-title">Total Spent</div>
              <div className="stat-value orange">₹{report.total_spent}</div>
            </div>

            <div className="stat-card">
              <div className="stat-title">Transactions</div>
              <div className="stat-value">{report.total_transactions}</div>
            </div>

            <div className="stat-card">
              <div className="stat-title">Top Category</div>
              <div className="stat-value blue">{report.highest_spending_category}</div>
            </div>

            <div className="stat-card">
              <div className="stat-title">Savings Streak</div>
              <div className="stat-value green">
                {streak > 0 ? `🔥 ${streak} Days` : "Start your streak Now"}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-title">Forecast</div>
              <div className="stat-value forecast">
                ₹{forecast ?? "Calculating..."}
              </div>
            </div>

          </div>
        )}

        <div className="dashboard-grid">

          <div className="sidebar">

            <h2>Budget</h2>

            <p className="budget-note">
              <b>Note</b> : Budget can only be changed <b>3</b> times per month
            </p>

            <form onSubmit={setMonthlyBudget}>

              <input
                placeholder="Set Monthly Budget"
                value={budget}
                onChange={(e)=>setBudget(e.target.value)}
              />

              <button type="submit">Set</button>

            </form>

            {report && report.budget !== null && (

              <div className="budget-info">

                <p>Monthly Budget</p>
                <p className="blue">₹{report.budget ?? 0}</p>

                <p>Total Spent</p>
                <p className="orange">₹{report.total_spent}</p>

                <p>Budget Used</p>
                <p className="red">{report.budget_used_percentage ?? 0}%</p>

                <div className="progress-bar">
                  <div
                    className="progress"
                    style={{
                      width:`${report.budget_used_percentage ?? 0}%`
                    }}
                  ></div>
                </div>

                <p>Remaining Budget</p>
                <p className="green">₹{report.remaining_budget ?? 0}</p>

              </div>

            )}

          </div>

          <div className="main-panel">

            <h2>Expenses</h2>

            <div className="expense-controls">

              <input
                placeholder="Search expense..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Food">Food</option>
                <option value="Transport">Transport</option>
                <option value="Shopping">Shopping</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Bills">Bills</option>
                <option value="others">Others</option>
              </select>

            </div>

            <form className="expense-form" onSubmit={addExpense}>

              <input
                placeholder="Title"
                value={title}
                onChange={(e)=>setTitle(e.target.value)}
              />

              <input
                placeholder="Amount"
                type="number"
                value={amount}
                onChange={(e)=>setAmount(e.target.value)}
              />

              <button type="submit">Add</button>

            </form>

            <table>

              <thead>
                <tr>
                  <th>Title</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>

                {expenses.length === 0 && (
                  <tr>
                    <td colSpan="5">No expenses yet</td>
                  </tr>
                )}

                {expenses
                  .filter((e) =>
                    e.title.toLowerCase().includes(search.toLowerCase())
                  )
                  .filter((e) =>
                    categoryFilter === "All" ? true : e.category === categoryFilter
                  )
                  .map((e) => (

                    <tr key={e.id}>
                      <td>{e.title}</td>
                      <td className="orange">₹{e.amount}</td>

                      <td>
                        <select
                          value={e.category}
                          onChange={(event) => updateCategory(e.id, event.target.value)}
                        >
                          <option value="Food">Food</option>
                          <option value="Transport">Transport</option>
                          <option value="Shopping">Shopping</option>
                          <option value="Entertainment">Entertainment</option>
                          <option value="Bills">Bills</option>
                          <option value="others">Others</option>
                        </select>
                      </td>

                      <td>{new Date(e.created_at).toLocaleDateString()}</td>

                      <td>
                        <button
                          className="delete-btn"
                          onClick={()=>deleteExpense(e.id)}
                        >
                          Delete
                        </button>
                      </td>

                    </tr>

                  ))}

              </tbody>

            </table>

          </div>

          {report && report.charts && (

            <div className="chart-panel">

              <h2>Expense Analytics</h2>

              <ResponsiveContainer width="100%" height={300}>

                <PieChart>

                  <Pie
                    data={report.charts.pie_chart}
                    dataKey="amount"
                    nameKey="category"
                    outerRadius={110}
                    label
                  >

                    {report.charts.pie_chart.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}

                  </Pie>

                  <Tooltip />
                  <Legend verticalAlign="bottom" align="center" />

                </PieChart>

              </ResponsiveContainer>

              <h3>Expense Trend</h3>

              <ResponsiveContainer width="100%" height={250}>

                <LineChart data={trend}>

                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />

                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#3b82f6"
                    strokeWidth={3}
                  />

                </LineChart>

              </ResponsiveContainer>

            </div>

          )}

        </div>

      </div>

    </div>
  );
}

export default Dashboard;