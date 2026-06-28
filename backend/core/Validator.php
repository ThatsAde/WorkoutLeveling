<?php

class ValidationException extends RuntimeException {
    public function __construct(public readonly array $errors) {
        parent::__construct('Validation failed');
    }
}

class Validator {
    private array $errors = [];

    public function __construct(private array $data) {}

    public static function make(array $data): self {
        return new self($data);
    }

    public function required(string $field): self {
        if (!isset($this->data[$field]) || $this->data[$field] === '' || $this->data[$field] === null) {
            $this->errors[$field] = "$field is required";
        }
        return $this;
    }

    public function string(string $field, int $maxLen = 255, bool $nullable = false): self {
        if ($nullable && (!isset($this->data[$field]) || $this->data[$field] === null)) {
            return $this;
        }
        if (isset($this->data[$field]) && strlen((string) $this->data[$field]) > $maxLen) {
            $this->errors[$field] = "$field must be at most $maxLen characters";
        }
        return $this;
    }

    public function integer(string $field, ?int $min = null, ?int $max = null, bool $nullable = false): self {
        if ($nullable && (!isset($this->data[$field]) || $this->data[$field] === null || $this->data[$field] === '')) {
            return $this;
        }
        if (!isset($this->data[$field]) || $this->data[$field] === '') {
            return $this;
        }
        if (!is_numeric($this->data[$field]) || (int) $this->data[$field] != $this->data[$field]) {
            $this->errors[$field] = "$field must be an integer";
            return $this;
        }
        $val = (int) $this->data[$field];
        if ($min !== null && $val < $min) {
            $this->errors[$field] = "$field must be at least $min";
        }
        if ($max !== null && $val > $max) {
            $this->errors[$field] = "$field must be at most $max";
        }
        return $this;
    }

    public function float(string $field, bool $nullable = false): self {
        if ($nullable && (!isset($this->data[$field]) || $this->data[$field] === null || $this->data[$field] === '')) {
            return $this;
        }
        if (isset($this->data[$field]) && $this->data[$field] !== '' && !is_numeric($this->data[$field])) {
            $this->errors[$field] = "$field must be a number";
        }
        return $this;
    }

    public function boolean(string $field, bool $nullable = false): self {
        if ($nullable && (!isset($this->data[$field]) || $this->data[$field] === null)) {
            return $this;
        }
        if (isset($this->data[$field]) && !in_array($this->data[$field], [0, 1, '0', '1', true, false], true)) {
            $this->errors[$field] = "$field must be a boolean";
        }
        return $this;
    }

    public function url(string $field, bool $nullable = false): self {
        if ($nullable && (!isset($this->data[$field]) || $this->data[$field] === null || $this->data[$field] === '')) {
            return $this;
        }
        if (!isset($this->data[$field]) || $this->data[$field] === '') {
            return $this;
        }
        $val = $this->data[$field];
        // Accept absolute URLs OR site-relative paths starting with /
        $isRelative = is_string($val) && str_starts_with($val, '/');
        if (!$isRelative && !filter_var($val, FILTER_VALIDATE_URL)) {
            $this->errors[$field] = "$field must be a valid URL";
        }
        return $this;
    }

    public function inList(string $field, array $allowed, bool $nullable = false): self {
        if ($nullable && (!isset($this->data[$field]) || $this->data[$field] === null || $this->data[$field] === '')) {
            return $this;
        }
        if (isset($this->data[$field]) && !in_array($this->data[$field], $allowed)) {
            $this->errors[$field] = "$field must be one of: " . implode(', ', $allowed);
        }
        return $this;
    }

    public function validate(): array {
        if (!empty($this->errors)) {
            throw new ValidationException($this->errors);
        }
        return $this->data;
    }

    public function get(string $field, mixed $default = null): mixed {
        return $this->data[$field] ?? $default;
    }
}
