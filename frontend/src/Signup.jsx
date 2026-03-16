import { useState } from "react";

function Signup({ setShowSignup }) {

  const [username,setUsername] = useState("");
  const [password,setPassword] = useState("");

  const handleSignup = async (e) => {

    e.preventDefault();

    const res = await fetch("http://127.0.0.1:8000/register",{
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

    if(data.message === "User created"){
      alert("Account created successfully!");
      setShowSignup(false);
    }
    else{
      alert("Signup failed");
    }

  };

  return (

    <div className="auth-page">

      <div className="auth-card">

        <h2>ExpenseTracker</h2>
        <p className="auth-subtitle">Create your account</p>

        <form onSubmit={handleSignup}>

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
          Sign Up
          </button>

        </form>

        <p className="auth-switch">

          Already have an account?

          <span onClick={()=>setShowSignup(false)}>
          Login
          </span>

        </p>

      </div>

    </div>

  );
}

export default Signup;