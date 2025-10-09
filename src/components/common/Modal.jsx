import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

export default function Modal({ isOpen, onClose, title, children, frameless = false }) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />
        </Transition.Child>

        <div className="fixed inset-0 z-[999] overflow-y-auto" onClick={onClose}> {/* Added onClick={onClose} here */}
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              {frameless ? (
                <div className="relative w-full max-w-md mx-auto p-4" onClick={(e) => e.stopPropagation()}>{children}</div>
              ) : (
                <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-lg bg-discord-dark-2 text-left align-middle shadow-xl transition-all p-4" onClick={(e) => e.stopPropagation()}>
                  {title && (
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-white p-6 pb-4"
                    >
                      {title}
                    </Dialog.Title>
                  )}
                  <div className="p-6">
                    {children}
                  </div>
                </Dialog.Panel>
              )}
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
