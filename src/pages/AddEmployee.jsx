// ✅ AddEmployee.jsx
import { useState } from 'react'

const AddEmployee = () => {
  const [form, setForm] = useState({
    name: '',
    age: '',
    citizenId: '',
    birthdate: '',
    nationality: '',
    address: '',
    education: '',
    phone: '',
    notes: '',
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('📤 เพิ่มพนักงานใหม่:', form)
    alert('เพิ่มข้อมูลพนักงานสำเร็จ (mock)')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto text-white bg-gray-900 min-h-screen">
      <h2 className="text-2xl font-bold mb-6">เพิ่มพนักงานใหม่</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">ชื่อ - สกุล</label>
          <input
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">อายุ</label>
            <input
              name="age"
              type="number"
              value={form.age}
              onChange={handleChange}
              className="w-full p-2 border rounded bg-gray-800 text-white"
            />
          </div>
          <div>
            <label className="block mb-1">เลขประจำตัวประชาชน</label>
            <input
              name="citizenId"
              type="text"
              value={form.citizenId}
              onChange={handleChange}
              className="w-full p-2 border rounded bg-gray-800 text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">วันเดือนปีเกิด</label>
            <input
              name="birthdate"
              type="date"
              value={form.birthdate}
              onChange={handleChange}
              className="w-full p-2 border rounded bg-gray-800 text-white"
            />
          </div>
          <div>
            <label className="block mb-1">สัญชาติ</label>
            <input
              name="nationality"
              type="text"
              value={form.nationality}
              onChange={handleChange}
              className="w-full p-2 border rounded bg-gray-800 text-white"
            />
          </div>
        </div>

        <div>
          <label className="block mb-1">ที่อยู่</label>
          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            className="w-full p-2 border rounded bg-gray-800 text-white"
            rows="2"
          />
        </div>

        <div>
          <label className="block mb-1">การศึกษา</label>
          <textarea
            name="education"
            value={form.education}
            onChange={handleChange}
            className="w-full p-2 border rounded bg-gray-800 text-white"
            rows="3"
          />
        </div>

        <div>
          <label className="block mb-1">เบอร์โทร</label>
          <input
            name="phone"
            type="text"
            value={form.phone}
            onChange={handleChange}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          />
        </div>

        <div>
          <label className="block mb-1">ข้อมูลเพิ่มเติม</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            className="w-full p-2 border rounded bg-gray-800 text-white"
            rows="3"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          บันทึกพนักงาน
        </button>
      </form>
    </div>
  )
}

export default AddEmployee
