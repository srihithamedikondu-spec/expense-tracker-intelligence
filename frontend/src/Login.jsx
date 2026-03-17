import { useState } from "react";

function Login({ setLoggedIn, setShowSignup }) {

  const [username,setUsername] = useState("");
  const [password,setPassword] = useState("");

  const handleLogin = async (e) => {

    e.preventDefault();

    const res = await fetch("https://expense-tracker-intelligence.onrender.com/login",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        username,
        password
      })
    });

    const data = await res.json();

    if(data.message === "Login successful"){
      localStorage.setItem("user_id",data.user_id);
      setLoggedIn(true);
    }
    else{
      alert("Invalid username or password");
    }

  };

  return (

    <div className="auth-page">

      <div className="auth-card">

        <h2>ExpenseTracker</h2>
        <p className="auth-subtitle">Track your spending smarter</p>

        <form onSubmit={handleLogin}>

          <input
          placeholder="Username"
          value={username}
          onChange={(e)=>setUsername(e.target.value)}
          />

          <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          />

          <button type="submit" className="login-btn">
          Login
          </button>

        </form>

        <p className="auth-switch">

          Don't have an account?

          <span onClick={()=>setShowSignup(true)}>
          Sign Up
          </span>

        </p>

      </div>

    </div>

  );
}

export default Login;