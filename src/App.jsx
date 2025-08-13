import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Home from './pages/Home'
import Documents from './pages/Documents'
import Profile from './pages/Profile'
import AddEmployee from './pages/AddEmployee'
import Login from './pages/Login'
import Sales from './pages/Sales'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route
        path="/home"
        element={
          <AppLayout>
            <Home />
          </AppLayout>
        }
      />

      <Route
        path="/documents"
        element={
          <AppLayout>
            <Documents />
          </AppLayout>
        }
      />

      <Route
        path="/profile"
        element={
          <AppLayout>
            <Profile />
          </AppLayout>
        }
      />

      <Route
        path="/add-employee"
        element={
          <AppLayout>
            <AddEmployee />
          </AppLayout>
        }
      />

      <Route
        path="/sales"
        element={
          <AppLayout>
            <Sales />
          </AppLayout>
        }
      />

      <Route
        path="/member-signup"
        element={
          <AppLayout>
            <MemberSignup />
          </AppLayout>
        }
      />
    </Routes>

      
    
  )
}

export default App
