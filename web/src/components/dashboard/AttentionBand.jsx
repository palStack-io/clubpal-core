import PickCTACard from './PickCTACard'
import RsvpNeededCard from './RsvpNeededCard'

/**
 * "Needs you" band — the action-first cluster directly under the stats.
 * Surfaces your-turn pick CTA and events awaiting your RSVP.
 * Renders nothing when there is nothing to act on.
 */
export default function AttentionBand({
  activeTurn,
  primaryGroupId,
  onSkip,
  onAlreadyPicked,
  rsvpNeeded = [],
  userId,
  onRsvpResponded,
}) {
  const hasTurn = !!activeTurn
  const hasRsvp = rsvpNeeded.length > 0

  if (!hasTurn && !hasRsvp) return null

  return (
    <div className="cp-attention-band">
      {hasTurn && (
        <PickCTACard
          turn={activeTurn}
          groupId={primaryGroupId}
          onSkip={onSkip}
          onAlreadyPicked={onAlreadyPicked}
        />
      )}
      {hasRsvp && (
        <div id="tour-rsvp">
          <RsvpNeededCard
            events={rsvpNeeded}
            userId={userId}
            onResponded={onRsvpResponded}
          />
        </div>
      )}
    </div>
  )
}
