/**
 * Convert a number to English currency words (e.g., 25590 -> Twenty Five Thousand Five Hundred & Ninety Only.)
 */
const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertThreeDigit(num) {
  let str = '';
  const hundred = Math.floor(num / 100);
  const remainder = num % 100;

  if (hundred > 0) {
    str += ones[hundred] + ' Hundred';
    if (remainder > 0) str += ' ';
  }

  if (remainder > 0) {
    if (remainder < 20) {
      str += ones[remainder];
    } else {
      const ten = Math.floor(remainder / 10);
      const one = remainder % 10;
      str += tens[ten];
      if (one > 0) str += ' ' + ones[one];
    }
  }

  return str;
}

export function numberToWords(amount) {
  if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
    return 'Zero Rupees Only.';
  }

  const num = Math.floor(Number(amount));
  const cents = Math.round((Number(amount) - num) * 100);

  if (num === 0 && cents > 0) {
    return `${cents}/100 Cents Only.`;
  }

  const billions = Math.floor(num / 1000000000);
  const millions = Math.floor((num % 1000000000) / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = num % 1000;

  let words = '';

  if (billions > 0) {
    words += convertThreeDigit(billions) + ' Billion ';
  }
  if (millions > 0) {
    words += convertThreeDigit(millions) + ' Million ';
  }
  if (thousands > 0) {
    words += convertThreeDigit(thousands) + ' Thousand ';
  }
  if (remainder > 0) {
    // If we have thousands and remainder is under 100, add &
    if (words && remainder < 100) {
      words += '& ' + convertThreeDigit(remainder);
    } else {
      words += convertThreeDigit(remainder);
    }
  }

  words = words.trim();

  // Add cents if any
  if (cents > 0) {
    return `${words} & ${cents}/100 Cents Only.`;
  }

  return `${words} Only.`;
}

export default numberToWords;
