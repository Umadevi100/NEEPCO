import { toast } from 'react-toastify';

export function handleError(error) {
  console.error('Error:', error);
  toast.error(error.message || 'An error occurred. Please try again.');
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
}

export function getInitials(name) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase();
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}