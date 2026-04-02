#!/bin/sh

# Start cron jobs in background using tsx with import flag
sleep 2 && node --import tsx --eval "
import('./app/models/membership.server.ts').then(module => {
  module.startMonthlyMembershipCheck();
  console.log('🚀 Started monthly membership check');
}).catch(err => console.error('Error loading membership cron:', err));

import('./app/models/workshop.server.ts').then(module => {
  module.startWorkshopOccurrenceStatusUpdate();
  console.log('🚀 Started workshop status update');
}).catch(err => console.error('Error loading workshop cron:', err));
" &

# Start the main application
exec npm run start
