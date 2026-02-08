'use client'

interface CharacterCounterProps {
  current: number
  max: number
  min?: number
}

export function CharacterCounter({ current, max, min = 0 }: CharacterCounterProps) {
  const percentage = (current / max) * 100
  const isApproachingLimit = percentage >= 80
  const isOverLimit = current > max
  const isBelowMin = current < min

  const getColor = () => {
    if (isOverLimit || isBelowMin) return 'text-red-600'
    if (isApproachingLimit) return 'text-yellow-600'
    return 'text-gray-600'
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <p className={`font-medium ${getColor()}`}>
        {current.toLocaleString()} / {max.toLocaleString()} characters
      </p>
      {min > 0 && current < min && (
        <p className="text-red-600 text-xs">
          Minimum {min} characters required
        </p>
      )}
      {isOverLimit && (
        <p className="text-red-600 text-xs">
          Exceeds maximum length by {(current - max).toLocaleString()}
        </p>
      )}
    </div>
  )
}
