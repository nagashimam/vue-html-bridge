# Vue.js HTML Bridge Test Specifications

## **Script Analysis**

### **Union Types (Props):** If a prop is defined as a union of literals, generate a variation for *each* member.
#### input
```Vue
<template>
  <div :aria-hidden="hidden">test</div>
</template>
<script lang="ts" setup>
const props = defineProps<{ hidden: 'true' | 'false' }>()
</script>
```
#### output
```JSON
[
  {
    "plain": "<div aria-hidden=\"true\">test</div>\n",
    "annotated": "<div\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"2\"\n  data-end-column=\"40\"\n  aria-hidden=\"true\"\n  data-aria-hidden-start-line=\"2\"\n  data-aria-hidden-start-column=\"8\"\n  data-aria-hidden-end-line=\"2\"\n  data-aria-hidden-end-column=\"29\"\n>\n  test\n</div>\n"
  },
  {
    "plain": "<div aria-hidden=\"false\">test</div>\n",
    "annotated": "<div\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"2\"\n  data-end-column=\"40\"\n  aria-hidden=\"false\"\n  data-aria-hidden-start-line=\"2\"\n  data-aria-hidden-start-column=\"8\"\n  data-aria-hidden-end-line=\"2\"\n  data-aria-hidden-end-column=\"29\"\n>\n  test\n</div>\n"
  }
]
```

### **Booleans (Props):** Automatically expand `boolean` props to `true` and `false` scenarios.
#### input
```Vue
<template>
  <button :disabled="isDisabled">Click</button>
</template>
<script lang="ts" setup>
defineProps<{ isDisabled: boolean }>()
</script>
```
#### output
```JSON
[
  {
    "plain": "<button disabled=\"true\">Click</button>\n",
    "annotated": "<button\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"2\"\n  data-end-column=\"48\"\n  disabled=\"true\"\n  data-disabled-start-line=\"2\"\n  data-disabled-start-column=\"11\"\n  data-disabled-end-line=\"2\"\n  data-disabled-end-column=\"33\"\n>\n  Click\n</button>\n"
  },
  {
    "plain": "<button disabled=\"false\">Click</button>\n",
    "annotated": "<button\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"2\"\n  data-end-column=\"48\"\n  disabled=\"false\"\n  data-disabled-start-line=\"2\"\n  data-disabled-start-column=\"11\"\n  data-disabled-end-line=\"2\"\n  data-disabled-end-column=\"33\"\n>\n  Click\n</button>\n"
  }
]
```

### **Type Annotation Priority:** If a local variable has an explicit Union Type annotation, prioritize it over the initial value.
#### input
```Vue
<template>
  <span :class="theme">text</span>
</template>
<script lang="ts" setup>
const theme: 'light' | 'dark' = 'light'
</script>
```
#### output
```JSON
[
  {
    "plain": "<span class=\"light\">text</span>\n",
    "annotated": "<span\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"2\"\n  data-end-column=\"35\"\n  class=\"light\"\n  data-class-start-line=\"2\"\n  data-class-start-column=\"9\"\n  data-class-end-line=\"2\"\n  data-class-end-column=\"23\"\n>\n  text\n</span>\n"
  },
  {
    "plain": "<span class=\"dark\">text</span>\n",
    "annotated": "<span\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"2\"\n  data-end-column=\"35\"\n  class=\"dark\"\n  data-class-start-line=\"2\"\n  data-class-start-column=\"9\"\n  data-class-end-line=\"2\"\n  data-class-end-column=\"23\"\n>\n  text\n</span>\n"
  }
]
```

---

## **Template Permutation**

### **`v-if` / `v-else`:** Generate distinct outputs for all branches.
#### input
```Vue
<template>
  <div v-if="true">A</div>
  <div v-else>B</div>
</template>
```
#### output
```JSON
[
  {
    "plain": "<div>A</div>\n",
    "annotated": "<div\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"2\"\n  data-end-column=\"27\"\n>\n  A\n</div>\n"
  },
  {
    "plain": "<div>B</div>\n",
    "annotated": "<div\n  data-start-line=\"3\"\n  data-start-column=\"3\"\n  data-end-line=\"3\"\n  data-end-column=\"22\"\n>\n  B\n</div>\n"
  }
]
```

### **Implicit Else:** If `v-if` has no else, generate an empty output.
#### input
```Vue
<template>
  <span v-if="loaded">Done</span>
</template>
```
#### output
```JSON
[
  {
    "plain": "<span>Done</span>\n",
    "annotated": "<span\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"2\"\n  data-end-column=\"34\"\n>\n  Done\n</span>\n"
  },
  {
    "plain": "",
    "annotated": ""
  }
]
```

### **`v-show`:** Generate a "Visible" variation and a "Hidden" (empty) variation.
#### input
```Vue
<template>
  <div v-show="isOpen">Content</div>
</template>
```
#### output
```JSON
[
  {
    "plain": "<div>Content</div>\n",
    "annotated": "<div\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"2\"\n  data-end-column=\"37\"\n>\n  Content\n</div>\n"
  },
  {
    "plain": "",
    "annotated": ""
  }
]
```

### **`<template>` Unwrap:** Render children directly, discarding the wrapper.
#### input
```Vue
<template>
  <div class="root">
    <template v-if="true">
      <span>Child</span>
    </template>
  </div>
</template>
```
#### output
```JSON
[
  {
    "plain": "<div class=\"root\"><span>Child</span></div>\n",
    "annotated": "<div\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"6\"\n  data-end-column=\"9\"\n  class=\"root\"\n  data-class-start-line=\"2\"\n  data-class-start-column=\"8\"\n  data-class-end-line=\"2\"\n  data-class-end-column=\"20\"\n>\n  <span\n    data-start-line=\"4\"\n    data-start-column=\"7\"\n    data-end-line=\"4\"\n    data-end-column=\"25\"\n  >\n    Child\n  </span>\n</div>\n"
  },
  {
    "plain": "<div class=\"root\"></div>\n",
    "annotated": "<div\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"6\"\n  data-end-column=\"9\"\n  class=\"root\"\n  data-class-start-line=\"2\"\n  data-class-start-column=\"8\"\n  data-class-end-line=\"2\"\n  data-class-end-column=\"20\"\n></div>\n"
  }
]
```

---

## **Rendering & Injection**

### **Interpolation:** Replace `{{ var }}` with concrete strings from context.
#### input
```Vue
<template>
  <h1>{{ title }}</h1>
</template>
<script lang="ts" setup>
const title = "Hello"
</script>
```
#### output
```JSON
[
  {
    "plain": "<h1>Hello</h1>\n",
    "annotated": "<h1\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"2\"\n  data-end-column=\"23\"\n>\n  Hello\n</h1>\n"
  }
]
```

### **`v-for` Data Injection (Known Array):** Generate Empty and Plural variations using all array items.
#### input
```Vue
<template>
  <ul>
    <li v-for="tag in tags">{{ tag }}</li>
  </ul>
</template>
<script lang="ts" setup>
const tags = ["A", "B"]
</script>
```
#### output
```JSON
[
  {
    "plain": "<ul></ul>\n",
    "annotated": "<ul\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"4\"\n  data-end-column=\"8\"\n></ul>\n"
  },
  {
    "plain": "<ul>\n  <li>A</li>\n  <li>B</li>\n</ul>\n",
    "annotated": "<ul\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"4\"\n  data-end-column=\"8\"\n>\n  <li\n    data-start-line=\"3\"\n    data-start-column=\"5\"\n    data-end-line=\"3\"\n    data-end-column=\"43\"\n  >\n    A\n  </li>\n  <li\n    data-start-line=\"3\"\n    data-start-column=\"5\"\n    data-end-line=\"3\"\n    data-end-column=\"43\"\n  >\n    B\n  </li>\n</ul>\n"
  }
]
```

### **`v-for` Mock Injection (Unknown Array):** Generate Empty, Single, and Plural variations with mock values.
#### input
```Vue
<template>
  <div>
    <span v-for="item in unknownList">{{ item }}</span>
  </div>
</template>
```
#### output
```JSON
[
  {
    "plain": "<div></div>\n",
    "annotated": "<div\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"4\"\n  data-end-column=\"9\"\n></div>\n"
  },
  {
    "plain": "<div><span>mock-item</span></div>\n",
    "annotated": "<div\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"4\"\n  data-end-column=\"9\"\n>\n  <span\n    data-start-line=\"3\"\n    data-start-column=\"5\"\n    data-end-line=\"3\"\n    data-end-column=\"56\"\n  >\n    mock-item\n  </span>\n</div>\n"
  },
  {
    "plain": "<div>\n  <span>mock-item</span>\n  <span>mock-item</span>\n</div>\n",
    "annotated": "<div\n  data-start-line=\"2\"\n  data-start-column=\"3\"\n  data-end-line=\"4\"\n  data-end-column=\"9\"\n>\n  <span\n    data-start-line=\"3\"\n    data-start-column=\"5\"\n    data-end-line=\"3\"\n    data-end-column=\"56\"\n  >\n    mock-item\n  </span>\n  <span\n    data-start-line=\"3\"\n    data-start-column=\"5\"\n    data-end-line=\"3\"\n    data-end-column=\"56\"\n  >\n    mock-item\n  </span>\n</div>\n"
  }
]
```
