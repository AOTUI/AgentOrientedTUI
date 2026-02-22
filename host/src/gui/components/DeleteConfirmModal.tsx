import React from 'react';
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { IconDelete } from './Icons.js';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export function DeleteConfirmModal({ isOpen, onClose, onConfirm }: DeleteConfirmModalProps) {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md">
            <Card className="w-[400px] mat-lg-regular rounded-[20px]">
                <CardBody className="gap-4 p-6">
                    <h3 className="text-[17px] font-semibold text-[var(--color-danger)] flex items-center gap-2 tracking-tight">
                        <IconDelete /> Delete Session
                    </h3>
                    <p className="text-[13px] text-[var(--color-text-secondary)]">
                        Are you sure you want to terminate this session? All context and data will be purged from the runtime.
                    </p>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button size="sm" variant="flat" onClick={onClose} className="bg-[var(--mat-lg-clear-bg)] text-[var(--color-text-primary)]">
                            Cancel
                        </Button>
                        <Button size="sm" color="danger" onClick={onConfirm}>
                            Delete
                        </Button>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
