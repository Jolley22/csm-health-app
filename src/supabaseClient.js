import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bkpvwqdtmyfamhryytql.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrcHZ3cWR0bXlmYW1ocnl5dHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTU2OTcsImV4cCI6MjA4NTE5MTY5N30.iW3GhVAqE8BLxXNe4G1MZFmcy5AvxksFC47eNddGfG4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);