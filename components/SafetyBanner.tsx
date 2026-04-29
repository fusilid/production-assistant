"use client";

interface SafetyBannerProps {
  reason?: string;
}

export function SafetyBanner({ reason }: SafetyBannerProps) {
  return (
    <div className="bg-red-600 text-white rounded-lg p-4 mb-4 border-2 border-red-800">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">⚠️</span>
        <div>
          <p className="font-bold text-lg uppercase tracking-wide">Safety Escalation Required</p>
          <p className="font-semibold mt-1">
            Stop work. Notify EHS lead immediately. Do not resume production until EHS clears the area.
          </p>
          {reason && (
            <p className="mt-2 text-red-100 text-sm">
              <span className="font-semibold">Trigger: </span>{reason}
            </p>
          )}
          <div className="mt-3 text-sm text-red-100 space-y-1">
            <p>• Evacuate affected area if any chemical, fire, or electrical hazard is present</p>
            <p>• Apply LOTO before any maintenance contact with equipment</p>
            <p>• Do not re-enter until EHS lead provides written clearance</p>
            <p>• Document all observations for the incident investigation</p>
          </div>
        </div>
      </div>
    </div>
  );
}
