import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';

const CSVImport = ({ userId, onImportComplete }) => {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const parseCSV = (text) => {
    // Remove BOM if present
    text = text.replace(/^\ufeff/, '');
    
    // Split into lines but handle quoted fields
    const lines = [];
    let currentLine = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      }
      
      if (char === '\n' && !inQuotes) {
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = '';
      } else if (char === '\r') {
        // Skip carriage returns
        continue;
      } else {
        currentLine += char;
      }
    }
    
    if (currentLine.trim()) {
      lines.push(currentLine);
    }
    
    // Parse header
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.replace(/"/g, '').trim().replace(/\s+/g, ' '));
    
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      
      if (values.length < headers.length) continue;
      
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      // Only add rows with a customer name
      if (row['Customer'] && row['Customer'].trim()) {
        data.push(row);
      }
    }
    
    return data;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      console.log('Parsed rows:', rows.length);
      console.log('Sample row:', rows[0]);

      if (rows.length === 0) {
        throw new Error('No valid data found in CSV file');
      }

      // Group by customer
      const customerMap = {};
      rows.forEach(row => {
        const customerName = row['Customer'];
        if (!customerName || customerName.trim() === '') return;

        if (!customerMap[customerName]) {
          customerMap[customerName] = [];
        }
        customerMap[customerName].push(row);
      });

      console.log('Unique customers:', Object.keys(customerMap).length);

      let customersCreated = 0;
      let historyCreated = 0;

      // Process each customer
      for (const [customerName, entries] of Object.entries(customerMap)) {
        // Sort by date (most recent first)
        entries.sort((a, b) => {
          try {
            const dateA = new Date(a['Date']);
            const dateB = new Date(b['Date']);
            return dateB - dateA;
          } catch {
            return 0;
          }
        });

        const latestEntry = entries[0];
        
        // Extract segment from "Segment/Industry" column
        const segment = latestEntry['Segment/Industry'] || latestEntry['Segment'] || '';

        // Create customer record with latest data
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .insert({
            user_id: userId,
            name: customerName,
            segment: segment,
            csm: latestEntry['Owner'] || '',
            tools_deployed: latestEntry['Tools Deployed'] || '',
            interaction_champion: latestEntry['Interaction with Champion'] || '',
            interaction_decision_maker: latestEntry['Interaction with Decision Maker'] || '',
            days_active: latestEntry['Days Active (30 Days)'] || '',
            roi_established: latestEntry['ROI Established'] || '',
            champion_nps: latestEntry['Champion/Decision Maker NPS'] || '',
            end_user_nps: latestEntry['End User NPS'] || '',
            support_survey: latestEntry['End User Support Survey Score'] || '',
            sentiment: latestEntry['Sentiment'] || '',
            leadership: latestEntry['Leadership Change'] || '',
            notes: '',
            is_active: true
          })
          .select()
          .single();

        if (customerError) {
          console.error('Error creating customer:', customerError);
          continue;
        }

        customersCreated++;

        // Create history entries for all dates
        for (const entry of entries) {
          const dateStr = entry['Date'];
          if (!dateStr || dateStr.includes('#') || dateStr.trim() === '') continue;

          try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) continue;

            const { error: historyError } = await supabase
              .from('customer_history')
              .insert({
                customer_id: customer.id,
                user_id: userId,
                snapshot_date: date.toISOString().split('T')[0],
                tools_deployed: entry['Tools Deployed'] || '',
                interaction_champion: entry['Interaction with Champion'] || '',
                interaction_decision_maker: entry['Interaction with Decision Maker'] || '',
                days_active: entry['Days Active (30 Days)'] || '',
                roi_established: entry['ROI Established'] || '',
                champion_nps: entry['Champion/Decision Maker NPS'] || '',
                end_user_nps: entry['End User NPS'] || '',
                support_survey: entry['End User Support Survey Score'] || '',
                sentiment: entry['Sentiment'] || '',
                leadership: entry['Leadership Change'] || ''
              });

            if (!historyError) {
              historyCreated++;
            }
          } catch (dateError) {
            console.error('Date parsing error:', dateError, dateStr);
          }
        }
      }

      setResult({
        customersCreated,
        historyCreated
      });

      // Notify parent to reload data
      setTimeout(() => {
        onImportComplete();
      }, 2000);

    } catch (err) {
      console.error('Import error:', err);
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mb-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Import Historical Data</h2>
        
        {!result && !error && (
          <div>
            <p className="text-gray-600 mb-4">
              Upload your CSV file with historical customer health scores.
            </p>
            
            <label className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
              <Upload className="w-5 h-5" />
              {importing ? 'Importing...' : 'Choose CSV File'}
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={importing}
                className="hidden"
              />
            </label>
          </div>
        )}

        {importing && (
          <div className="flex items-center gap-3 text-blue-600">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Importing data, please wait...</span>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900 mb-2">Import Successful!</h3>
                <p className="text-green-800">
                  Created {result.customersCreated} customer{result.customersCreated !== 1 ? 's' : ''} with {result.historyCreated} historical snapshot{result.historyCreated !== 1 ? 's' : ''}.
                </p>
                <button
                  onClick={() => setResult(null)}
                  className="mt-3 text-sm text-green-700 underline hover:text-green-900"
                >
                  Import another file
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Import Failed</h3>
                <p className="text-red-800 text-sm">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="mt-3 text-sm text-red-700 underline hover:text-red-900"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVImport;