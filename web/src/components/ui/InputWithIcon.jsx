/**
 * InputWithIcon — wraps a form input with a left icon adornment
 */
export default function InputWithIcon({ icon, children }) {
  return (
    <div className="cp-input-icon-wrap">
      <span className="cp-input-icon">{icon}</span>
      {children}
    </div>
  )
}
