/**
 * Monthly Survey Reminder Script
 *
 * This script runs via GitHub Actions on the 1st of each month.
 * It fetches all CSMs with active customers from Supabase and posts
 * personalized survey links to a Slack channel.
 */

const { createClient } = require('@supabase/supabase-js');

// Environment variables (set in GitHub Secrets)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://your-app-url.com';

// CSM list - should match your app's CSM list
const CSMS = ['Brooke', 'Natalie', 'Ryan', 'Jasmin', 'Jake', 'Jessica', 'Cody', 'Emmalyn'];

// Optional: Map CSM names to Slack user IDs for @mentions
// You can find Slack user IDs by clicking on a user profile > More > Copy member ID
const CSM_SLACK_IDS = {
  // 'Brooke': 'U01ABC123',
  // 'Natalie': 'U02DEF456',
  // Add your team's Slack IDs here for @mentions
};

async function main() {
  // Validate environment variables
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  if (!SLACK_WEBHOOK_URL) {
    console.error('Missing SLACK_WEBHOOK_URL. Set it in GitHub Secrets.');
    process.exit(1);
  }

  // Initialize Supabase client with service role key (bypasses RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('Fetching customers from Supabase...');

  // Fetch all active customers
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, name, csm, is_active')
    .eq('is_active', true)
    .order('csm');

  if (error) {
    console.error('Error fetching customers:', error.message);
    process.exit(1);
  }

  console.log(`Found ${customers.length} active customers`);

  // Group customers by CSM
  const customersByCSM = {};
  for (const customer of customers) {
    if (!customer.csm) continue;
    if (!customersByCSM[customer.csm]) {
      customersByCSM[customer.csm] = [];
    }
    customersByCSM[customer.csm].push(customer);
  }

  // Generate survey links for each CSM
  const surveyLinks = [];
  for (const csm of CSMS) {
    const csmCustomers = customersByCSM[csm] || [];
    if (csmCustomers.length === 0) continue;

    // Use query params instead of hash - Slack handles these better
    const surveyUrl = `${APP_BASE_URL}?survey&csm=${encodeURIComponent(csm)}`;

    // Check if we have a Slack ID for @mention
    const slackMention = CSM_SLACK_IDS[csm] ? `<@${CSM_SLACK_IDS[csm]}>` : `*${csm}*`;

    surveyLinks.push({
      csm,
      slackMention,
      customerCount: csmCustomers.length,
      url: surveyUrl
    });
  }

  if (surveyLinks.length === 0) {
    console.log('No CSMs with active customers found. Skipping Slack notification.');
    return;
  }

  // Build Slack message
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Build the CSM list with Slack link formatting
  const csmList = surveyLinks.map(link =>
    `• *${link.csm}* (${link.customerCount} customer${link.customerCount !== 1 ? 's' : ''}): <${link.url}|Start Survey>`
  ).join('\n');

  // Use simple text format - Slack handles links better this way
  const slackMessage = {
    text: `*Customer Health Survey - ${currentMonth}*\n\nHey team! It's time for the monthly Customer Health Score survey. Please complete your survey by the end of the week.\n\n${csmList}\n\n_Click your personalized link above to begin the survey._`
  };

  // Send to Slack
  console.log('Sending Slack notification...');

  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(slackMessage),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to send Slack message:', errorText);
    process.exit(1);
  }

  console.log('Slack notification sent successfully!');
  console.log(`Notified ${surveyLinks.length} CSMs about their surveys.`);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
