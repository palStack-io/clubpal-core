import { StarIcon } from '@heroicons/react/24/solid'
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline'

const labels = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Great', 5: 'Excellent' }

export function StarDisplay({ score, size = 'sm' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' }
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          className={`${sizes[size]} ${star <= score ? 'text-yellow-400' : 'text-gray-200'}`}
        />
      ))}
    </div>
  )
}

export function StarPicker({ value, onChange }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            {star <= value ? (
              <StarIcon className="h-10 w-10 text-yellow-400" />
            ) : (
              <StarOutlineIcon className="h-10 w-10 text-gray-300 hover:text-yellow-300" />
            )}
          </button>
        ))}
      </div>
      {value > 0 && (
        <span className="text-sm font-medium text-gray-600">{labels[value]}</span>
      )}
    </div>
  )
}
