/**
 * Loading Skeleton for Analysis Page
 * Displayed while analysis data is being fetched
 */

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="max-w-5xl mx-auto animate-pulse">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-48"></div>
        </div>

        {/* Actions skeleton */}
        <div className="flex gap-3 mb-6">
          <div className="h-10 bg-gray-200 rounded w-28"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
          <div className="h-10 bg-gray-200 rounded w-40"></div>
        </div>

        {/* Progress bar skeleton */}
        <div className="bg-gray-100 rounded-lg border border-gray-200 p-4 mb-6">
          <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-full"></div>
        </div>

        {/* Meta skeleton */}
        <div className="bg-gray-100 rounded-lg border border-gray-200 p-4 mb-6">
          <div className="h-4 bg-gray-200 rounded w-32 mb-3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </div>
            <div>
              <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-16"></div>
            </div>
            <div>
              <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-40"></div>
            </div>
            <div>
              <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
          </div>
        </div>

        {/* Analysis sections skeleton */}
        <div className="bg-gray-100 rounded-lg border border-gray-200 p-6 mb-6">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="h-5 bg-gray-200 rounded w-40 mb-2"></div>
                <div className="space-y-2 ml-4">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Todo list skeleton */}
        <div>
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-100 rounded-lg border border-gray-200 p-4">
                <div className="h-5 bg-gray-200 rounded w-48 mb-3"></div>
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="flex items-start gap-3">
                      <div className="h-5 w-5 bg-gray-200 rounded"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
