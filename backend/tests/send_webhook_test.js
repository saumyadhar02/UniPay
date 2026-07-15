(async ()=>{
  const base = 'http://localhost:5000';
  try{
    console.log('Registering test user...');
    let res = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name: 'Webhook Test', phone: '9998887776', pin: '1234', password: 'pass123' })
    });
    const reg = await res.text();
    console.log('Register response:', reg);

    console.log('Posting webhook payload...');
    let payload = { provider: 'test', providerPaymentId: 'pay_webhook_1', amount: 500, phone: '9998887776', walletId: null, topupId: 'webhook-topup-1' };
    res = await fetch(base + '/api/webhooks/generic', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const wh = await res.text();
    console.log('Webhook response:', wh);

    console.log('Done.');
  }catch(err){
    console.error('Error in test script:', err);
  }
})();
