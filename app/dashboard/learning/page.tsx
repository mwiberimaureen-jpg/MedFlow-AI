import { DailyLearningSparkWrapper } from '@/components/learning-spark/DailyLearningSparkWrapper'

export default function LearningPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Daily Learning Spark</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm md:text-base">Fun daily medical learning based on your patient cases</p>
      </div>

      <DailyLearningSparkWrapper />
    </div>
  )
}
