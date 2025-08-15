import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Home from './pages/Home'
import Documents from './pages/Documents'
import Order from './pages/Order'
import AddEmployee from './pages/AddEmployee'
import Login from './pages/Login'
import Sales from './pages/Sales'
import MemberSignup from './pages/MemberSignup'
import MemberSearch from './pages/MemberSearch'

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
        path="/order"
        element={
          <AppLayout>
            <Order />
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

      <Route
       path="/search"
      element={
          <AppLayout>
            <MemberSearch />
          </AppLayout>
  }
/>

    </Routes>

      
    
  )
}

export default App
