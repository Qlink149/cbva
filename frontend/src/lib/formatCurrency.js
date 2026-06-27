// Format INR amounts in Indian notation (Lakhs/Crores)
export function formatINR(amount, opts = {}) {
  if (amount == null || isNaN(amount)) return '₹0';
  
  const abs = Math.abs(amount);
  const isNeg = amount < 0;
  const prefix = isNeg ? '(' : '';
  const suffix = isNeg ? ')' : '';
  
  let formatted;
  if (abs >= 10000000) {
    // Crores (1 Cr = 10,000,000)
    formatted = `₹${(abs / 10000000).toFixed(2)} Cr`;
  } else if (abs >= 100000) {
    // Lakhs (1 L = 100,000)
    formatted = `₹${(abs / 100000).toFixed(1)} L`;
  } else if (abs >= 1000) {
    formatted = `₹${(abs / 1000).toFixed(1)}K`;
  } else {
    formatted = `₹${abs.toFixed(0)}`;
  }
  
  return `${prefix}${formatted}${suffix}`;
}

export function formatINRFull(amount) {
  if (amount == null || isNaN(amount)) return '₹0';
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  // Indian number formatting
  const formatted = abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  return isNeg ? `(₹${formatted})` : `₹${formatted}`;
}

// For hero metrics — big number with smaller suffix
export function formatINRHero(amount) {
  if (amount == null || isNaN(amount)) return { number: '0', suffix: '' };
  const abs = Math.abs(amount);
  if (abs >= 10000000) {
    return { number: `₹${(abs / 10000000).toFixed(1)}`, suffix: 'Cr' };
  } else if (abs >= 100000) {
    return { number: `₹${(abs / 100000).toFixed(1)}`, suffix: 'L' };
  }
  return { number: `₹${(abs / 1000).toFixed(1)}`, suffix: 'K' };
}