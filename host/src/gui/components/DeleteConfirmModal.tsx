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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Card className="w-[400px] border border-danger/30 bg-[#0a0a0a]">
                <CardBody className="gap-4 p-6">
                    <h3 className="text-lg font-bold text-danger flex items-center gap-2">
                        <IconDelete /> DELETE SESSION
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        Are you sure you want to terminate this session? All context and data will be purged from the runtime.
                    </p>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button size="sm" variant="flat" onClick={onClose}>
                            CANCEL
                        </Button>
                        <Button size="sm" color="danger" onClick={onConfirm}>
                            CONFIRM DELETION
                        </Button>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
