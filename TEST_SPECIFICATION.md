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
    "plain": "<div aria-hidden=\"true\">test</div>",
    "annotated": "<div data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"2\" data-end-column=\"40\" aria-hidden=\"true\" data-aria-hidden-start-line=\"2\" data-aria-hidden-start-column=\"8\" data-aria-hidden-end-line=\"2\" data-aria-hidden-end-column=\"29\">test</div>"
  },
  {
    "plain": "<div aria-hidden=\"false\">test</div>",
    "annotated": "<div data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"2\" data-end-column=\"40\" aria-hidden=\"false\" data-aria-hidden-start-line=\"2\" data-aria-hidden-start-column=\"8\" data-aria-hidden-end-line=\"2\" data-aria-hidden-end-column=\"29\">test</div>"
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
    "plain": "<button disabled=\"true\">Click</button>",
    "annotated": "<button data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"2\" data-end-column=\"48\" disabled=\"true\" data-disabled-start-line=\"2\" data-disabled-start-column=\"11\" data-disabled-end-line=\"2\" data-disabled-end-column=\"33\">Click</button>"
  },
  {
    "plain": "<button disabled=\"false\">Click</button>",
    "annotated": "<button data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"2\" data-end-column=\"48\" disabled=\"false\" data-disabled-start-line=\"2\" data-disabled-start-column=\"11\" data-disabled-end-line=\"2\" data-disabled-end-column=\"33\">Click</button>"
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
    "plain": "<span class=\"light\">text</span>",
    "annotated": "<span data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"2\" data-end-column=\"35\" class=\"light\" data-class-start-line=\"2\" data-class-start-column=\"9\" data-class-end-line=\"2\" data-class-end-column=\"23\">text</span>"
  },
  {
    "plain": "<span class=\"dark\">text</span>",
    "annotated": "<span data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"2\" data-end-column=\"35\" class=\"dark\" data-class-start-line=\"2\" data-class-start-column=\"9\" data-class-end-line=\"2\" data-class-end-column=\"23\">text</span>"
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
    "plain": "<div>A</div>",
    "annotated": "<div data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"2\" data-end-column=\"27\">A</div>"
  },
  {
    "plain": "<div>B</div>",
    "annotated": "<div data-start-line=\"3\" data-start-column=\"3\" data-end-line=\"3\" data-end-column=\"22\">B</div>"
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
    "plain": "<span>Done</span>",
    "annotated": "<span data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"2\" data-end-column=\"34\">Done</span>"
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
    "plain": "<div>Content</div>",
    "annotated": "<div data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"2\" data-end-column=\"37\">Content</div>"
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
    "plain": "<div class=\"root\"><span>Child</span></div>",
    "annotated": "<div data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"6\" data-end-column=\"9\" class=\"root\" data-class-start-line=\"2\" data-class-start-column=\"8\" data-class-end-line=\"2\" data-class-end-column=\"20\"><span data-start-line=\"4\" data-start-column=\"7\" data-end-line=\"4\" data-end-column=\"25\">Child</span></div>"
  },
  {
    "plain": "<div class=\"root\"></div>",
    "annotated": "<div data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"6\" data-end-column=\"9\" class=\"root\" data-class-start-line=\"2\" data-class-start-column=\"8\" data-class-end-line=\"2\" data-class-end-column=\"20\"></div>"
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
    "plain": "<h1>Hello</h1>",
    "annotated": "<h1 data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"2\" data-end-column=\"23\">Hello</h1>"
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
    "plain": "<ul></ul>",
    "annotated": "<ul data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"4\" data-end-column=\"8\"></ul>"
  },
  {
    "plain": "<ul><li>A</li><li>B</li></ul>",
    "annotated": "<ul data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"4\" data-end-column=\"8\"><li data-start-line=\"3\" data-start-column=\"5\" data-end-line=\"3\" data-end-column=\"43\">A</li><li data-start-line=\"3\" data-start-column=\"5\" data-end-line=\"3\" data-end-column=\"43\">B</li></ul>"
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
    "plain": "<div></div>",
    "annotated": "<div data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"4\" data-end-column=\"9\"></div>"
  },
  {
    "plain": "<div><span>mock-item</span></div>",
    "annotated": "<div data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"4\" data-end-column=\"9\"><span data-start-line=\"3\" data-start-column=\"5\" data-end-line=\"3\" data-end-column=\"56\">mock-item</span></div>"
  },
  {
    "plain": "<div><span>mock-item</span><span>mock-item</span></div>",
    "annotated": "<div data-start-line=\"2\" data-start-column=\"3\" data-end-line=\"4\" data-end-column=\"9\"><span data-start-line=\"3\" data-start-column=\"5\" data-end-line=\"3\" data-end-column=\"56\">mock-item</span><span data-start-line=\"3\" data-start-column=\"5\" data-end-line=\"3\" data-end-column=\"56\">mock-item</span></div>"
  }
]
```
