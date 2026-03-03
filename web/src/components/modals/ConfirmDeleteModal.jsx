import BaseModal from './BaseModal'
import Button from '../ui/Button'

export default function ConfirmDeleteModal({ isOpen, onClose, onConfirm, itemName = 'this item', loading }) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Delete ${itemName}?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>Delete</Button>
        </>
      }
    >
      <p style={{ fontSize: '13px', color: 'var(--t2)', lineHeight: 1.6 }}>
        This action is permanent and cannot be undone. All associated data will be lost.
      </p>
    </BaseModal>
  )
}
