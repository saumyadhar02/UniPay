(async ()=>{
  const base = 'http://localhost:5000';
  try{
    console.log('Logging in test user...');
    let res = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ phone: '9998887776', pin: '1234' })
    });
    const login = await res.json();
    console.log('Login response:', login);
    if(!login.token){ console.log('No token, abort'); return; }
    const token = login.token;

    console.log('Fetching balance...');
    res = await fetch(base + '/api/wallet/balance', { headers: { 'x-auth-token': token } });
    const bal = await res.json();
    console.log('Balance:', bal);

    console.log('Fetching transactions...');
    res = await fetch(base + '/api/wallet/transactions', { headers: { 'x-auth-token': token } });
    const txs = await res.json();
    console.log('Transactions:', JSON.stringify(txs, null, 2));

  }catch(err){
    console.error('Error in check script:', err);
  }
})();
