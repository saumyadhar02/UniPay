(async ()=>{
  const base = 'http://localhost:5000';
  try{
    console.log('Registering test user...');
    let res = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name: 'Topup Test', phone: '9997776665', pin: '1234', password: 'pass123' })
    });
    const reg = await res.json();
    console.log('Register response:', reg);

    if(!reg || !reg.token){
      console.error('Registration failed, aborting test.');
      return;
    }

    const token = reg.token;

    console.log('Initiating topup via API...');
    res = await fetch(base + '/api/payments/topup/init', {
      method: 'POST',
      headers: {'Content-Type':'application/json', 'x-auth-token': token},
      body: JSON.stringify({ amount: 500, provider: 'test' })
    });
    const init = await res.json();
    console.log('Topup init response:', init);

    // Simulate provider webhook by calling /api/payments/topup/complete with raw body and HMAC
    const payload = { topupId: init.topupId, providerPaymentId: 'test-pay-123', amount: 500, provider: 'test' };
    const raw = JSON.stringify(payload);

    // compute signature if secret present in env (test runner can set PROVIDER_WEBHOOK_SECRET)
    const secret = process.env.PROVIDER_WEBHOOK_SECRET || '';
    let sig = '';
    if(secret){
      const crypto = require('crypto');
      sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    }

    console.log('Calling /api/payments/topup/complete with raw body...');
    res = await fetch(base + '/api/payments/topup/complete', {
      method: 'POST',
      headers: {'Content-Type':'application/json', 'x-provider-signature': sig},
      body: raw
    });
    const complete = await res.json();
    console.log('Complete response:', complete);

    console.log('Checking user balance...');
    res = await fetch(base + '/api/auth/me', { headers: { 'x-auth-token': token } });
    const me = await res.json();
    console.log('User data:', me);

    console.log('Done.');
  }catch(err){
    console.error('Error in test script:', err);
  }
})();
