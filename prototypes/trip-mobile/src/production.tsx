import React from 'react';
import ReactDOM from 'react-dom/client';
import Prototype from './Prototype';
import {ProductionRuntime} from './production/native-runtime';
import {credentials} from './integration-api';
import './prototype.css';
import './production/web.css';
try {
  const token=sessionStorage.getItem('tripToolSession');
  const expiry=Number(sessionStorage.getItem('tripToolExpires'));
  if(token&&expiry>Date.now()){
    credentials.token=token;
    credentials.user=sessionStorage.getItem('tripToolUser')||localStorage.getItem('agnamoTripUser')||'';
  }else{
    sessionStorage.removeItem('tripToolSession');
    sessionStorage.removeItem('tripToolExpires');
    sessionStorage.removeItem('tripToolUser');
  }
}catch{
  // Restricted browser storage must not prevent the account screen from opening.
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ProductionRuntime><Prototype/></ProductionRuntime></React.StrictMode>);
