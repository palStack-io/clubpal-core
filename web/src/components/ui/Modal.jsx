import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  xxl: 'max-w-6xl',
}

export default function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 max-sm:items-end max-sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95 max-sm:translate-y-full"
              enterTo="opacity-100 scale-100 max-sm:translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100 max-sm:translate-y-0"
              leaveTo="opacity-0 scale-95 max-sm:translate-y-full"
            >
              <Dialog.Panel className={`cp-modal-panel w-full ${sizes[size]}`}>
                <div className="cp-modal-header">
                  <Dialog.Title className="cp-modal-title">{title}</Dialog.Title>
                  <button
                    onClick={onClose}
                    className="cp-modal-close"
                    aria-label="Close dialog"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="cp-modal-body">
                  {children}
                </div>
                {footer && (
                  <div className="cp-modal-footer">
                    {footer}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
