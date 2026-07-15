const axios = require('axios');

const API = 'http://localhost:5000/api';

async function run() {
  try {
    console.log('Starting E2E test against', API);

    const genPhone = () => '9' + Math.floor(100000000 + Math.random() * 899999999).toString();
    const phoneA = genPhone();
    const phoneB = genPhone();

    console.log('Registering user A', phoneA);
    const regA = await axios.post(`${API}/auth/register`, { name: 'UserA', phone: phoneA, pin: '1234' });
    console.log('Reg A response:', regA.data);

    console.log('Registering user B', phoneB);
    const regB = await axios.post(`${API}/auth/register`, { name: 'UserB', phone: phoneB, pin: '1234' });
    console.log('Reg B response:', regB.data);

    // Login A
    const loginA = await axios.post(`${API}/auth/login`, { phone: phoneA, pin: '1234' });
    const tokenA = loginA.data.token;
    console.log('Login A token obtained');

    // Top-up A
    console.log('Initiating topup for A');
    const init = await axios.post(`${API}/payments/topup/init`, { amount: 500 }, { headers: { 'x-auth-token': tokenA } });
    console.log('Topup init:', init.data);

    console.log('Completing topup for A');
    const complete = await axios.post(`${API}/payments/topup/complete`, { topupId: init.data.topupId });
    console.log('Topup complete:', complete.data);

    // Verify A balance
    const meA = await axios.get(`${API}/auth/me`, { headers: { 'x-auth-token': tokenA } });
    console.log('User A balance after topup:', meA.data.user.balance);

    // Send money A -> B
    console.log(`Sending ₹200 from A to B (${phoneB})`);
    const send = await axios.post(`${API}/wallet/send`, { recipient: phoneB, amount: 200, pin: '1234', idempotencyKey: 'e2e-' + Date.now() }, { headers: { 'x-auth-token': tokenA } });
    console.log('Send response:', send.data);

    // Check balances
    const meA2 = await axios.get(`${API}/auth/me`, { headers: { 'x-auth-token': tokenA } });
    console.log('User A balance after send:', meA2.data.user.balance);

    const loginB = await axios.post(`${API}/auth/login`, { phone: phoneB, pin: '1234' });
    const tokenB = loginB.data.token;
    const meB = await axios.get(`${API}/auth/me`, { headers: { 'x-auth-token': tokenB } });
    console.log('User B balance after receiving:', meB.data.user.balance);

    console.log('E2E test completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('E2E test failed:', err.response ? err.response.data : err.message);
    process.exit(2);
  }
}

run();
