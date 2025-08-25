import { classNames } from '../../lib/utils';

export default function Input({
  type = 'text',
  label,
  error,
  className = '',
  ...props
}) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        className={classNames(
          'block w-full rounded-md shadow-sm',
          'border-gray-300 focus:border-primary-500 focus:ring-primary-500',
          error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}