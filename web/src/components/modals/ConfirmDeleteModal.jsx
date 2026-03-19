import Modal from '../ui/Modal'
import Button from '../ui/Button'

export default function ConfirmDeleteModal({ isOpen, onClose, onConfirm, itemName = 'this item', loading }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Delete ${itemName}?`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>Delete</Button>
        </>
      }
    >
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--t2)', lineHeight: 1.6 }}>
        This action is permanent and cannot be undone. All associated data will be lost.
      </p>
    </Modal>
  )
}
