import { useState } from "react";
import Login from "./Login";
import Signup from "./Signup";
import Dashboard from "./Dashboard";

function App() {

  const [loggedIn,setLoggedIn] = useState(false);
  const [showSignup,setShowSignup] = useState(false);

  if(loggedIn){
    return <Dashboard />
  }

  if(showSignup){
    return <Signup setShowSignup={setShowSignup}/>
  }

  return (
    <Login
      setLoggedIn={setLoggedIn}
      setShowSignup={setShowSignup}
    />
  );
}

export default App;