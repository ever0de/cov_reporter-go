package collections

type Stack []interface{}

func NewStack() *Stack {
	s := make(Stack, 0)
	return &s
}

func (s *Stack) IsEmpty() bool {
	return len(*s) == 0
}

func (s *Stack) Push(v interface{}) {
	*s = append(*s, v)
}

func (s *Stack) Pop() interface{} {
	if s.IsEmpty() {
		return nil
	}

	v := (*s)[len(*s)-1]
	*s = (*s)[:len(*s)-1]
	return v
}
